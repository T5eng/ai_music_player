"use client";

import { useEffect, useRef } from "react";

interface Props {
  playing: boolean;
  tags: string[];
}

export function Visualizer({ playing, tags }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 280;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    let t = 0;

    const draw = () => {
      t += playing ? 0.04 : 0.01;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;

      for (let i = 0; i < 48; i++) {
        const angle = (i / 48) * Math.PI * 2;
        const wave = Math.sin(t * 2 + i * 0.4) * 0.5 + 0.5;
        const r = 80 + wave * (playing ? 40 : 15);

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        const hue = 270 + i * 2;
        ctx.beginPath();
        ctx.arc(x, y, playing ? 3 + wave * 2 : 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${0.3 + wave * 0.5})`;
        ctx.fill();
      }

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      grad.addColorStop(0, "rgba(168, 85, 247, 0.15)");
      grad.addColorStop(1, "rgba(168, 85, 247, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing]);

  return (
    <div className="relative mx-auto flex h-[280px] w-[280px] items-center justify-center">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-accent-muted/30 backdrop-blur">
          <span className="text-3xl">🎵</span>
        </div>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
