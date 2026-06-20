"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Upload,
  Music2,
  Trash2,
  ArrowLeft,
  KeyRound,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import type { Track, TrackMode } from "@/types";

const API_BASE = "/ai-music/api";
const TOKEN_KEY = "ai-music-admin-token";

export function AdminUploader() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    artist: "AI Radio",
    prompt: "",
    lyricsTheme: "",
    language: "zh",
    mode: "original" as TrackMode,
    tags: "",
  });

  const authHeaders = useCallback(
    () => ({
      "X-Admin-Secret": token,
    }),
    [token]
  );

  const loadTracks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tracks`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem(TOKEN_KEY);
        return;
      }
      const data = await res.json();
      setTracks(data.tracks || []);
      setAuthenticated(true);
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      setMessage({ type: "err", text: "加载失败" });
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) loadTracks();
    else setLoading(false);
  }, [token, loadTracks]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loadTracks();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ type: "err", text: "请选择音频文件" });
      return;
    }
    if (!form.title.trim()) {
      setMessage({ type: "err", text: "请填写标题" });
      return;
    }

    setUploading(true);
    setMessage(null);

    const body = new FormData();
    body.append("file", file);
    body.append("title", form.title);
    body.append("artist", form.artist);
    body.append("prompt", form.prompt);
    body.append("lyricsTheme", form.lyricsTheme || form.title);
    body.append("language", form.language);
    body.append("mode", form.mode);
    body.append("tags", form.tags);

    try {
      const res = await fetch(`${API_BASE}/admin/tracks`, {
        method: "POST",
        headers: authHeaders(),
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");

      setMessage({ type: "ok", text: `「${data.track.title}」上传成功` });
      setForm({
        title: "",
        artist: "AI Radio",
        prompt: "",
        lyricsTheme: "",
        language: "zh",
        mode: "original",
        tags: "",
      });
      if (fileRef.current) fileRef.current.value = "";
      loadTracks();
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "上传失败",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确定删除「${title}」？`)) return;

    const res = await fetch(`${API_BASE}/admin/tracks?id=${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      setMessage({ type: "ok", text: "已删除" });
      loadTracks();
    } else {
      setMessage({ type: "err", text: "删除失败" });
    }
  };

  if (!authenticated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 text-sm text-white/50 hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" />
          返回播放器
        </Link>

        <div className="rounded-2xl bg-surface-raised p-6">
          <div className="mb-6 flex items-center gap-3">
            <KeyRound className="h-6 w-6 text-accent" />
            <div>
              <h1 className="text-lg font-semibold">预置曲目管理</h1>
              <p className="text-xs text-white/40">输入管理密钥以继续</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="管理密钥 (ADMIN_SECRET)"
              className="w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!token || loading}
              className="w-full rounded-xl bg-accent py-3 text-sm font-medium transition hover:bg-accent-glow disabled:opacity-50"
            >
              {loading ? "验证中…" : "进入管理"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" />
          返回播放器
        </Link>
        <h1 className="text-lg font-semibold">预置曲目管理</h1>
        <span className="text-xs text-white/40">{tracks.length} 首</span>
      </div>

      {message && (
        <div
          className={clsx(
            "mb-4 rounded-xl px-4 py-3 text-sm",
            message.type === "ok"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-rose-500/20 text-rose-400"
          )}
        >
          {message.text}
        </div>
      )}

      <form
        onSubmit={handleUpload}
        className="mb-8 rounded-2xl bg-surface-raised p-6"
      >
        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white/40">
          <Upload className="h-4 w-4" />
          上传新曲目
        </h2>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-white/50">音频文件 *</span>
            <input
              ref={fileRef}
              type="file"
              accept=".mp3,.wav,.m4a,.flac,audio/*"
              className="w-full text-sm text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:text-white"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">标题 *</span>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="曲目名称"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">艺术家</span>
              <input
                value={form.artist}
                onChange={(e) =>
                  setForm((f) => ({ ...f, artist: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-white/50">
              风格描述（影响推荐）
            </span>
            <input
              value={form.prompt}
              onChange={(e) =>
                setForm((f) => ({ ...f, prompt: e.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="city pop, nostalgic, female vocal"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/50">
              标签（逗号分隔）
            </span>
            <input
              value={form.tags}
              onChange={(e) =>
                setForm((f) => ({ ...f, tags: e.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="流行, 治愈, 女声"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">类型</span>
              <select
                value={form.mode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mode: e.target.value as TrackMode,
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none"
              >
                <option value="original">原创</option>
                <option value="cover">翻唱</option>
                <option value="style_variation">风格变奏</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">语言</span>
              <select
                value={form.language}
                onChange={(e) =>
                  setForm((f) => ({ ...f, language: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none"
              >
                <option value="zh">中文</option>
                <option value="en">英文</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium transition hover:bg-accent-glow disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "上传中…" : "上传并加入曲库"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl bg-surface-raised p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white/40">
          <Music2 className="h-4 w-4" />
          已上传预置曲目
        </h2>

        {loading ? (
          <p className="text-sm text-white/40">加载中…</p>
        ) : tracks.length === 0 ? (
          <p className="text-sm text-white/40">暂无上传的预置曲目</p>
        ) : (
          <ul className="space-y-3">
            {tracks.map((track) => (
              <li
                key={track.id}
                className="flex items-center gap-3 rounded-xl bg-surface p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{track.title}</p>
                  <p className="truncate text-xs text-white/40">
                    {track.artist} · {track.prompt}
                  </p>
                  {track.audioUrl && (
                    <audio
                      src={track.audioUrl}
                      controls
                      className="mt-2 h-8 w-full"
                      preload="none"
                    />
                  )}
                </div>
                <button
                  onClick={() => handleDelete(track.id, track.title)}
                  className="shrink-0 rounded-lg p-2 text-white/30 transition hover:bg-rose-500/20 hover:text-rose-400"
                  aria-label="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
