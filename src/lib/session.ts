export function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through – randomUUID requires secure context on some browsers
    }
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  try {
    let id = localStorage.getItem("ai-music-session");
    if (!id) {
      id = generateId();
      localStorage.setItem("ai-music-session", id);
    }
    return id;
  } catch {
    return generateId();
  }
}
