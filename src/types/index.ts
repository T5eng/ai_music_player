export type TrackMode = "original" | "cover" | "style_variation";

export type TrackStatus =
  | "ready"
  | "generating"
  | "streaming"
  | "failed"
  | "planned";

export interface Track {
  id: string;
  title: string;
  artist: string;
  mode: TrackMode;
  prompt: string;
  lyricsTheme: string;
  language: string;
  audioUrl: string | null;
  streamUrl: string | null;
  coverUrl: string | null;
  durationMs: number | null;
  status: TrackStatus;
  murekaTaskId: string | null;
  tags: string[];
  createdAt: number;
}

export interface UserProfile {
  sessionId: string;
  energy: number;
  nostalgia: number;
  vocal: number;
  electronic: number;
  likedTags: string[];
  dislikedTags: string[];
  preferredLanguage: string;
  vocalId: string | null;
}

export interface GenerationSpec {
  mode: TrackMode;
  prompt: string;
  lyricsTheme: string;
  language: string;
  lyrics?: string;
  referenceId?: string;
  vocalId?: string;
}

export interface QueueState {
  current: Track | null;
  next: Track | null;
  generating: Track | null;
  upcoming: Track[];
}

export type PlayerEventType =
  | "play"
  | "complete"
  | "skip"
  | "like"
  | "dislike"
  | "progress";

export interface PlayerEvent {
  sessionId: string;
  trackId: string;
  type: PlayerEventType;
  progress?: number;
  timestamp: number;
}

export interface GenerationStatusEvent {
  trackId: string;
  status: TrackStatus;
  progress: number;
  message: string;
  audioUrl?: string | null;
  streamUrl?: string | null;
}
