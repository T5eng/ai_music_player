"use client";

import { Loader2, Music2, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import type { Track } from "@/types";

interface Props {
  next: Track | null;
  generating: Track | null;
  genStatus: { progress: number; message: string } | null;
}

export function QueuePanel({ next, generating, genStatus }: Props) {
  const item = generating || next;

  if (!item) return null;

  const isGenerating = item.status === "generating" || item.status === "streaming";
  const isReady = item.status === "ready";

  return (
    <div className="rounded-2xl bg-surface-raised p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/40">
        {isGenerating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isReady ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        ) : (
          <Music2 className="h-3 w-3" />
        )}
        {isGenerating ? "下一首 · 生成中" : isReady ? "下一首 · 已就绪" : "下一首"}
      </div>

      <p className="text-sm font-medium">{item.title}</p>
      <p className="mt-0.5 text-xs text-white/40">{item.prompt}</p>

      {isGenerating && genStatus && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-white/40">
            <span>{genStatus.message}</span>
            <span>{genStatus.progress}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-500",
                item.status === "streaming"
                  ? "animate-pulseGlow bg-emerald-500"
                  : "bg-accent"
              )}
              style={{ width: `${genStatus.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
