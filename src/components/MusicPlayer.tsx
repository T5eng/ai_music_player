"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipForward,
  Heart,
  ThumbsDown,
  Sparkles,
  Radio,
} from "lucide-react";
import clsx from "clsx";
import type { Track, QueueState, UserProfile } from "@/types";
import { PreferenceSliders } from "./PreferenceSliders";
import { QueuePanel } from "./QueuePanel";
import { Visualizer } from "./Visualizer";

const API_BASE = "/ai-music/api";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("ai-music-session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ai-music-session", id);
  }
  return id;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const sessionId = useRef(getSessionId());
  const progressSent = useRef(false);

  const [queue, setQueue] = useState<QueueState | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [murekaEnabled, setMurekaEnabled] = useState(false);
  const [reason, setReason] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(false);
  const [genStatus, setGenStatus] = useState<{
    progress: number;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const current = queue?.current;

  const initSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current }),
      });
      if (!res.ok) throw new Error(`Session init failed: ${res.status}`);
      const data = await res.json();
      setQueue(data.queue);
      setProfile(data.profile);
      setMurekaEnabled(data.murekaEnabled);
    } catch (err) {
      console.error("Failed to init session:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    const es = new EventSource(
      `${API_BASE}/stream?sessionId=${sessionId.current}`
    );

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "queue") {
        setQueue((prev) =>
          prev
            ? {
                ...prev,
                next: data.next,
                generating: data.generating,
                upcoming: [data.next, data.generating].filter(Boolean),
              }
            : prev
        );
      }
      if (data.type === "generation") {
        setGenStatus({
          progress: data.progress,
          message: data.message,
        });
        if (data.status === "ready") {
          setQueue((prev) =>
            prev ? { ...prev, next: { ...prev.next!, audioUrl: data.audioUrl, status: "ready" } as Track } : prev
          );
        }
      }
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (!current?.audioUrl || !audioRef.current) return;
    progressSent.current = false;
    setLiked(false);
    audioRef.current.src = current.audioUrl;
    audioRef.current.load();
    if (playing) {
      audioRef.current.play().catch(() => {});
    }
  }, [current?.id, current?.audioUrl]);

  const sendEvent = async (
    type: string,
    extra?: Record<string, unknown>
  ) => {
    const res = await fetch(`${API_BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId.current,
        trackId: current?.id,
        type,
        ...extra,
      }),
    });
    const data = await res.json();
    setQueue(data.queue);
    if (data.reason) setReason(data.reason);
    return data;
  };

  const togglePlay = () => {
    if (!audioRef.current || !current?.audioUrl) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
      sendEvent("play");
    }
  };

  const handleSkip = async () => {
    setPlaying(false);
    const data = await sendEvent("skip");
    if (data.queue?.current?.audioUrl) {
      setPlaying(true);
    }
  };

  const handleLike = () => {
    setLiked(true);
    sendEvent("like");
  };

  const handleDislike = async () => {
    setPlaying(false);
    await sendEvent("dislike");
    setPlaying(true);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || !current) return;
    setCurrentTime(audioRef.current.currentTime);
    setDuration(audioRef.current.duration || 0);

    const progress = audioRef.current.currentTime / (audioRef.current.duration || 1);
    if (progress > 0.5 && !progressSent.current) {
      progressSent.current = true;
      sendEvent("progress", { progress });
    }
  };

  const handleEnded = async () => {
    setPlaying(false);
    const data = await sendEvent("complete");
    if (data.queue?.current?.audioUrl) {
      setPlaying(true);
    }
  };

  const handlePrefChange = async (prefs: Partial<UserProfile>) => {
    const res = await fetch(`${API_BASE}/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId.current, ...prefs }),
    });
    const data = await res.json();
    setProfile(data.profile);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Radio className="h-10 w-10 animate-pulse text-accent" />
          <p className="text-sm text-white/50">正在启动 AI 电台…</p>
        </div>
      </div>
    );
  }

  if (!queue?.current) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-white/50">连接失败，请刷新页面重试</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-accent px-4 py-2 text-sm"
          >
            刷新
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-glow" />
          <h1 className="text-lg font-semibold tracking-tight">AI Music</h1>
        </div>
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            murekaEnabled
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-amber-500/20 text-amber-400"
          )}
        >
          {murekaEnabled ? "Mureka 已连接" : "演示模式"}
        </span>
      </header>

      <div className="animate-slideUp flex flex-1 flex-col gap-6">
        <Visualizer playing={playing} tags={current?.tags || []} />

        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            {current?.title || "等待播放"}
          </h2>
          <p className="mt-1 text-sm text-white/50">
            {current?.artist || "AI Radio"}
            {current?.mode && (
              <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-xs">
                {current.mode === "cover"
                  ? "翻唱"
                  : current.mode === "style_variation"
                    ? "变奏"
                    : "原创"}
              </span>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-glow transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={handleDislike}
            className="rounded-full p-3 text-white/40 transition hover:bg-white/10 hover:text-white/70"
            aria-label="不喜欢"
          >
            <ThumbsDown className="h-5 w-5" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!current?.audioUrl}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent shadow-lg shadow-accent/30 transition hover:bg-accent-glow disabled:opacity-40"
            aria-label={playing ? "暂停" : "播放"}
          >
            {playing ? (
              <Pause className="h-7 w-7" fill="currentColor" />
            ) : (
              <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
            )}
          </button>

          <button
            onClick={handleSkip}
            className="rounded-full p-3 text-white/40 transition hover:bg-white/10 hover:text-white/70"
            aria-label="下一首"
          >
            <SkipForward className="h-5 w-5" />
          </button>

          <button
            onClick={handleLike}
            className={clsx(
              "rounded-full p-3 transition",
              liked
                ? "text-rose-400"
                : "text-white/40 hover:bg-white/10 hover:text-white/70"
            )}
            aria-label="喜欢"
          >
            <Heart className="h-5 w-5" fill={liked ? "currentColor" : "none"} />
          </button>
        </div>

        {reason && (
          <p className="text-center text-xs text-white/40">
            下一首推荐：{reason}
          </p>
        )}

        <QueuePanel
          next={queue?.next || null}
          generating={queue?.generating || null}
          genStatus={genStatus}
        />

        {profile && (
          <PreferenceSliders profile={profile} onChange={handlePrefChange} />
        )}
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        preload="auto"
      />
    </div>
  );
}
