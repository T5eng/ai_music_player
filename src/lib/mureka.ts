const MUREKA_BASE = "https://api.mureka.ai";

export interface MurekaTaskResponse {
  id: string;
  created_at: number;
  model: string;
  status: string;
  trace_id?: string;
}

export interface MurekaChoice {
  index: number;
  id: string;
  url?: string;
  wav_url?: string;
  flac_url?: string;
  stream_url?: string;
  duration?: number;
  lyrics_sections?: unknown[];
}

export interface MurekaQueryResponse {
  id: string;
  status: string;
  choices?: MurekaChoice[];
  error?: { message: string };
  trace_id?: string;
}

export interface GenerateSongParams {
  lyrics: string;
  prompt?: string;
  model?: string;
  n?: number;
  stream?: boolean;
  referenceId?: string;
  vocalId?: string;
  melodyId?: string;
}

function getApiKey(): string | null {
  return process.env.MUREKA_API_KEY || null;
}

export function isMurekaEnabled(): boolean {
  return Boolean(getApiKey());
}

async function murekaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("MUREKA_API_KEY not configured");
  }

  const res = await fetch(`${MUREKA_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data?.error?.message || `Mureka API error: ${res.status}`
    );
  }

  return data as T;
}

export async function generateSong(
  params: GenerateSongParams
): Promise<MurekaTaskResponse> {
  const body: Record<string, unknown> = {
    lyrics: params.lyrics,
    model: params.model || "auto",
    n: params.n ?? 1,
    stream: params.stream ?? true,
  };

  if (params.prompt) body.prompt = params.prompt;
  if (params.referenceId) body.reference_id = params.referenceId;
  if (params.vocalId) body.vocal_id = params.vocalId;
  if (params.melodyId) body.melody_id = params.melodyId;

  return murekaFetch<MurekaTaskResponse>("/v1/song/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function querySongTask(
  taskId: string
): Promise<MurekaQueryResponse> {
  return murekaFetch<MurekaQueryResponse>(`/v1/song/query/${taskId}`);
}

export async function generateLyrics(theme: string): Promise<string> {
  if (!isMurekaEnabled()) {
    return buildFallbackLyrics(theme);
  }

  try {
    const data = await murekaFetch<{ lyrics: string }>("/v1/lyrics/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: theme }),
    });
    return data.lyrics || buildFallbackLyrics(theme);
  } catch {
    return buildFallbackLyrics(theme);
  }
}

function buildFallbackLyrics(theme: string): string {
  return `[Verse]
${theme}
星光落在窗台上
思绪飘向远方

[Chorus]
这是属于你的旋律
在夜里轻轻响起
AI 为你唱出心声
每一句都是惊喜`;
}

export async function pollUntilComplete(
  taskId: string,
  onProgress?: (status: string, choice?: MurekaChoice) => void,
  maxAttempts = 90,
  intervalMs = 3000
): Promise<MurekaChoice | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await querySongTask(taskId);
    const choice = result.choices?.[0];

    onProgress?.(result.status, choice);

    if (result.status === "succeeded" || result.status === "success") {
      return choice || null;
    }

    if (result.status === "failed" || result.status === "error") {
      throw new Error(result.error?.message || "Generation failed");
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Generation timed out");
}
