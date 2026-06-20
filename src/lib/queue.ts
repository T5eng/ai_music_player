import { v4 as uuidv4 } from "uuid";
import {
  getTrack,
  insertTrack,
  updateTrack,
  getReadyTracks,
  getOrCreateSession,
  updateSession,
  getSessionQueueIds,
  getRecentEvents,
  insertEvent,
} from "@/lib/db";
import {
  generateSong,
  generateLyrics,
  pollUntilComplete,
  isMurekaEnabled,
} from "@/lib/mureka";
import {
  buildGenerationSpec,
  applyEventToProfile,
  explainRecommendation,
} from "@/lib/recommender";
import type {
  Track,
  QueueState,
  GenerationSpec,
  PlayerEvent,
  GenerationStatusEvent,
} from "@/types";

const generationListeners = new Map<
  string,
  Set<(event: GenerationStatusEvent) => void>
>();

const activeGenerations = new Set<string>();

export function subscribeGeneration(
  trackId: string,
  listener: (event: GenerationStatusEvent) => void
) {
  if (!generationListeners.has(trackId)) {
    generationListeners.set(trackId, new Set());
  }
  generationListeners.get(trackId)!.add(listener);
  return () => {
    generationListeners.get(trackId)?.delete(listener);
  };
}

function emitGeneration(event: GenerationStatusEvent) {
  generationListeners.get(event.trackId)?.forEach((fn) => fn(event));
}

function statusToProgress(status: string): number {
  switch (status) {
    case "preparing":
    case "queued":
      return 10;
    case "running":
      return 40;
    case "streaming":
      return 70;
    case "succeeded":
    case "success":
      return 100;
    default:
      return 20;
  }
}

function specToTitle(spec: GenerationSpec): string {
  const modeLabel =
    spec.mode === "cover"
      ? "AI 翻唱"
      : spec.mode === "style_variation"
        ? "风格变奏"
        : "AI 原创";
  return `${modeLabel} · ${spec.lyricsTheme.slice(0, 12)}`;
}

export async function getQueueState(sessionId: string): Promise<QueueState> {
  getOrCreateSession(sessionId);
  const ids = getSessionQueueIds(sessionId);

  const current = ids.currentTrackId ? getTrack(ids.currentTrackId) : null;
  const next = ids.nextTrackId ? getTrack(ids.nextTrackId) : null;
  const generating = ids.generatingTrackId
    ? getTrack(ids.generatingTrackId)
    : null;

  return {
    current,
    next,
    generating,
    upcoming: [next, generating].filter(Boolean) as Track[],
  };
}

export async function initSession(sessionId: string): Promise<QueueState> {
  getOrCreateSession(sessionId);
  const ids = getSessionQueueIds(sessionId);

  if (!ids.currentTrackId) {
    const ready = getReadyTracks(1);
    if (ready.length > 0) {
      updateSession(sessionId, { currentTrackId: ready[0].id });
    }
  }

  if (!ids.nextTrackId && !ids.generatingTrackId) {
    await scheduleNextGeneration(sessionId);
  }

  return getQueueState(sessionId);
}

export async function scheduleNextGeneration(
  sessionId: string,
  overrideSpec?: Partial<GenerationSpec>
): Promise<Track | null> {
  const ids = getSessionQueueIds(sessionId);
  if (ids.generatingTrackId || ids.nextTrackId) {
    return ids.nextTrackId ? getTrack(ids.nextTrackId) : null;
  }

  const profile = getOrCreateSession(sessionId);
  const events = getRecentEvents(sessionId);
  const spec = { ...buildGenerationSpec(profile, events), ...overrideSpec };

  const track: Track = {
    id: uuidv4(),
    title: specToTitle(spec),
    artist: "AI Radio",
    mode: spec.mode,
    prompt: spec.prompt,
    lyricsTheme: spec.lyricsTheme,
    language: spec.language,
    audioUrl: null,
    streamUrl: null,
    coverUrl: null,
    durationMs: null,
    status: "generating",
    murekaTaskId: null,
    tags: spec.prompt.split(/[,\s]+/).filter(Boolean).slice(0, 5),
    createdAt: Date.now(),
  };

  insertTrack(track);
  updateSession(sessionId, { generatingTrackId: track.id });

  void runGeneration(sessionId, track.id, spec);

  return track;
}

async function runGeneration(
  sessionId: string,
  trackId: string,
  spec: GenerationSpec
) {
  if (activeGenerations.has(trackId)) return;
  activeGenerations.add(trackId);

  const emit = (
    status: Track["status"],
    message: string,
    extra?: Partial<GenerationStatusEvent>
  ) => {
    emitGeneration({
      trackId,
      status,
      progress: extra?.progress ?? statusToProgress(status),
      message,
      ...extra,
    });
  };

  try {
    emit("generating", "正在创作歌词…", { progress: 5 });

    const lyrics = spec.lyrics || (await generateLyrics(spec.lyricsTheme));

    if (!isMurekaEnabled()) {
      await runDemoGeneration(sessionId, trackId, spec);
      return;
    }

    emit("generating", "正在提交生成任务…", { progress: 15 });

    const task = await generateSong({
      lyrics,
      prompt: spec.prompt,
      stream: true,
      vocalId: spec.vocalId,
      referenceId: spec.referenceId,
      n: 1,
    });

    updateTrack(trackId, {
      murekaTaskId: task.id,
      status: "generating",
    });

    const choice = await pollUntilComplete(task.id, (status, choice) => {
      const isStreaming = status === "streaming";
      updateTrack(trackId, {
        status: isStreaming ? "streaming" : "generating",
        streamUrl: choice?.stream_url || null,
        audioUrl: choice?.url || null,
        durationMs: choice?.duration || null,
      });

      emit(isStreaming ? "streaming" : "generating", getStatusMessage(status), {
        progress: statusToProgress(status),
        streamUrl: choice?.stream_url,
        audioUrl: choice?.url,
      });
    });

    if (!choice?.url && !choice?.stream_url) {
      throw new Error("No audio URL returned");
    }

    updateTrack(trackId, {
      status: "ready",
      audioUrl: choice.url || choice.stream_url || null,
      streamUrl: choice.stream_url || null,
      durationMs: choice.duration || null,
    });

    emit("ready", "生成完成", {
      progress: 100,
      audioUrl: choice.url || choice.stream_url,
    });

    promoteToNext(sessionId, trackId);
  } catch (err) {
    console.error("Generation failed:", err);
    await fallbackToDemoTrack(sessionId, trackId, spec);
  } finally {
    activeGenerations.delete(trackId);
  }
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    preparing: "准备中…",
    queued: "排队中…",
    running: "编曲进行中…",
    streaming: "可以抢先试听！",
    succeeded: "生成完成",
    success: "生成完成",
  };
  return messages[status] || "生成中…";
}

async function runDemoGeneration(
  sessionId: string,
  trackId: string,
  spec: GenerationSpec
) {
  const steps = [
    { progress: 20, message: "分析曲风偏好…" },
    { progress: 45, message: "编曲进行中…" },
    { progress: 70, message: "合成声线与混音…" },
    { progress: 90, message: "渲染最终音频…" },
  ];

  for (const step of steps) {
    emitGeneration({
      trackId,
      status: "generating",
      progress: step.progress,
      message: step.message + " (演示模式)",
    });
    await new Promise((r) => setTimeout(r, 1200));
  }

  const demoUrl = pickDemoAudio(spec);
  updateTrack(trackId, {
    status: "ready",
    audioUrl: demoUrl,
    durationMs: 180000,
    title: specToTitle(spec),
  });

  emitGeneration({
    trackId,
    status: "ready",
    progress: 100,
    message: "演示曲目就绪（配置 MUREKA_API_KEY 启用真实生成）",
    audioUrl: demoUrl,
  });

  promoteToNext(sessionId, trackId);
}

async function fallbackToDemoTrack(
  sessionId: string,
  trackId: string,
  spec: GenerationSpec
) {
  const demoUrl = pickDemoAudio(spec);
  updateTrack(trackId, {
    status: "ready",
    audioUrl: demoUrl,
    durationMs: 180000,
  });

  emitGeneration({
    trackId,
    status: "ready",
    progress: 100,
    message: "已切换至备用曲目",
    audioUrl: demoUrl,
  });

  promoteToNext(sessionId, trackId);
}

function pickDemoAudio(spec: GenerationSpec): string {
  const demos = [
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  ];
  const hash = spec.lyricsTheme.length + spec.prompt.length;
  return demos[hash % demos.length];
}

function promoteToNext(sessionId: string, trackId: string) {
  const ids = getSessionQueueIds(sessionId);
  if (ids.generatingTrackId === trackId) {
    updateSession(sessionId, {
      generatingTrackId: null,
      nextTrackId: trackId,
    });
  }
}

export async function advanceQueue(sessionId: string): Promise<QueueState> {
  const ids = getSessionQueueIds(sessionId);

  if (ids.nextTrackId) {
    updateSession(sessionId, {
      currentTrackId: ids.nextTrackId,
      nextTrackId: null,
    });
    await scheduleNextGeneration(sessionId);
  } else {
    const ready = getReadyTracks(5).find(
      (t) => t.id !== ids.currentTrackId
    );
    if (ready) {
      updateSession(sessionId, { currentTrackId: ready.id });
    }
    await scheduleNextGeneration(sessionId);
  }

  return getQueueState(sessionId);
}

export async function handlePlayerEvent(
  sessionId: string,
  event: PlayerEvent
): Promise<QueueState> {
  insertEvent(event);

  const track = getTrack(event.trackId);
  if (track) {
    const profile = getOrCreateSession(sessionId);
    const updated = applyEventToProfile(profile, event, track.tags);
    updateSession(sessionId, {
      energy: updated.energy,
      nostalgia: updated.nostalgia,
      vocal: updated.vocal,
      electronic: updated.electronic,
      likedTags: updated.likedTags,
      dislikedTags: updated.dislikedTags,
    });
  }

  if (event.type === "skip" || event.type === "complete") {
    return advanceQueue(sessionId);
  }

  if (event.type === "progress" && (event.progress ?? 0) > 0.5) {
    const ids = getSessionQueueIds(sessionId);
    if (!ids.generatingTrackId && !ids.nextTrackId) {
      await scheduleNextGeneration(sessionId);
    }
  }

  return getQueueState(sessionId);
}

export function getRecommendationReason(sessionId: string): string {
  const profile = getOrCreateSession(sessionId);
  const events = getRecentEvents(sessionId);
  const spec = buildGenerationSpec(profile, events);
  return explainRecommendation(profile, spec);
}

export async function updatePreferences(
  sessionId: string,
  prefs: {
    energy?: number;
    nostalgia?: number;
    vocal?: number;
    electronic?: number;
    preferredLanguage?: string;
  }
) {
  updateSession(sessionId, prefs);
}
