"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-lg font-semibold">页面加载出错</h2>
      <p className="max-w-sm text-sm text-white/50">
        {error.message || "客户端发生异常，请刷新后重试"}
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium"
      >
        重试
      </button>
    </div>
  );
}
