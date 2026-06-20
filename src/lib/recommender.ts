import type { GenerationSpec, PlayerEvent, UserProfile } from "@/types";

const STYLE_POOL = {
  zh: [
    { prompt: "mandopop, emotional, female vocal, piano", tags: ["mandopop", "emotional", "piano"] },
    { prompt: "city pop, 80s, nostalgic, synth", tags: ["city pop", "nostalgic", "synth"] },
    { prompt: "chinese r&b, slow, male vocal, midnight", tags: ["r&b", "slow", "night"] },
    { prompt: "indie folk, acoustic guitar, warm", tags: ["folk", "acoustic", "warm"] },
    { prompt: "electronic pop, upbeat, energetic", tags: ["electronic", "upbeat", "dance"] },
    { prompt: "lo-fi hip hop, chill, study beats", tags: ["lo-fi", "chill", "beats"] },
    { prompt: "cinematic, orchestral, epic", tags: ["cinematic", "orchestral", "epic"] },
    { prompt: "jazz, smooth, saxophone, lounge", tags: ["jazz", "smooth", "lounge"] },
  ],
  en: [
    { prompt: "indie pop, dreamy, female vocal", tags: ["indie", "dreamy", "pop"] },
    { prompt: "synthwave, retro, neon nights", tags: ["synthwave", "retro", "neon"] },
    { prompt: "acoustic soul, warm, intimate", tags: ["soul", "acoustic", "intimate"] },
  ],
};

const THEMES = [
  "深夜城市里的独白",
  "雨后街角的回忆",
  "追逐梦想的旅程",
  "星空下的告白",
  "咖啡馆的午后",
  "地铁里的陌生人",
  "夏日海边的风",
  "冬日暖炉旁",
  "AI 为你写的情书",
  "未来世界的旋律",
];

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}

function pickTheme(profile: UserProfile, recentEvents: PlayerEvent[]): string {
  const liked = profile.likedTags;
  if (liked.length > 0 && Math.random() > 0.4) {
    const tag = liked[Math.floor(Math.random() * liked.length)];
    return `关于${tag}的故事`;
  }

  if (recentEvents.some((e) => e.type === "skip")) {
    return "换个心情，新的开始";
  }

  return THEMES[Math.floor(Math.random() * THEMES.length)];
}

function scoreStyle(
  style: { prompt: string; tags: string[] },
  profile: UserProfile
): number {
  let score = Math.random() * 0.3;

  for (const tag of style.tags) {
    if (profile.likedTags.includes(tag)) score += 2;
    if (profile.dislikedTags.includes(tag)) score -= 3;
  }

  if (profile.energy > 0.6 && style.tags.includes("upbeat")) score += 1;
  if (profile.energy < 0.4 && style.tags.includes("chill")) score += 1;
  if (profile.nostalgia > 0.6 && style.tags.includes("nostalgic")) score += 1.5;
  if (profile.vocal > 0.6 && style.prompt.includes("vocal")) score += 0.8;
  if (profile.electronic > 0.6 && style.tags.includes("electronic")) score += 1;

  return score;
}

export function buildGenerationSpec(
  profile: UserProfile,
  recentEvents: PlayerEvent[]
): GenerationSpec {
  const lang = profile.preferredLanguage || "zh";
  const pool = STYLE_POOL[lang as keyof typeof STYLE_POOL] || STYLE_POOL.zh;

  const ranked = [...pool].sort(
    (a, b) => scoreStyle(b, profile) - scoreStyle(a, profile)
  );

  const explore = Math.random() < 0.2;
  const style = explore
    ? pool[Math.floor(Math.random() * pool.length)]
    : ranked[0];

  const theme = pickTheme(profile, recentEvents);

  let mode: GenerationSpec["mode"] = "original";
  if (profile.vocalId && Math.random() > 0.5) {
    mode = "style_variation";
  } else if (Math.random() > 0.85) {
    mode = "cover";
  }

  let prompt = style.prompt;
  if (profile.energy > 0.7) prompt += ", energetic, driving";
  if (profile.energy < 0.3) prompt += ", calm, soft";
  if (profile.nostalgia > 0.7) prompt += ", nostalgic, vintage";
  if (profile.electronic > 0.7) prompt += ", electronic, synth";

  return {
    mode,
    prompt,
    lyricsTheme: theme,
    language: lang,
    vocalId: profile.vocalId || undefined,
  };
}

export function applyEventToProfile(
  profile: UserProfile,
  event: PlayerEvent,
  trackTags: string[]
): UserProfile {
  const liked = new Set(profile.likedTags);
  const disliked = new Set(profile.dislikedTags);

  switch (event.type) {
    case "like":
      trackTags.forEach((t) => liked.add(t));
      trackTags.forEach((t) => disliked.delete(t));
      return {
        ...profile,
        likedTags: [...liked],
        dislikedTags: [...disliked],
        energy: clamp(profile.energy + 0.05),
      };
    case "dislike":
    case "skip":
      trackTags.forEach((t) => disliked.add(t));
      return {
        ...profile,
        dislikedTags: [...disliked].slice(-20),
        energy: clamp(profile.energy - 0.03),
      };
    case "complete":
      trackTags.forEach((t) => liked.add(t));
      return {
        ...profile,
        likedTags: [...liked].slice(-30),
        nostalgia: clamp(profile.nostalgia + 0.02),
      };
    default:
      return profile;
  }
}

export function explainRecommendation(
  profile: UserProfile,
  spec: GenerationSpec
): string {
  const parts: string[] = [];

  if (profile.likedTags.length > 0) {
    parts.push(`你喜欢 ${profile.likedTags.slice(-3).join("、")}`);
  }

  if (profile.energy > 0.65) parts.push("偏好高能量");
  else if (profile.energy < 0.35) parts.push("偏好安静氛围");

  if (spec.mode === "style_variation") {
    parts.push("延续你的 AI 歌手风格");
  }

  return parts.length > 0
    ? parts.join("，")
    : "根据你的初始偏好推荐";
}
