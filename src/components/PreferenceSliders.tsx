"use client";

import type { UserProfile } from "@/types";

interface Props {
  profile: UserProfile;
  onChange: (prefs: Partial<UserProfile>) => void;
}

const SLIDERS = [
  { key: "energy" as const, label: "能量", left: "安静", right: "激昂" },
  { key: "nostalgia" as const, label: "怀旧", left: "现代", right: "复古" },
  { key: "vocal" as const, label: "人声", left: "器乐", right: "演唱" },
  { key: "electronic" as const, label: "电子", left: "原声", right: "合成" },
];

export function PreferenceSliders({ profile, onChange }: Props) {
  return (
    <div className="rounded-2xl bg-surface-raised p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">
        影响下一首生成
      </h3>
      <div className="space-y-3">
        {SLIDERS.map(({ key, label, left, right }) => (
          <div key={key}>
            <div className="mb-1 flex justify-between text-xs text-white/50">
              <span>{label}</span>
              <span>
                {left} ↔ {right}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(profile[key] * 100)}
              onChange={(e) =>
                onChange({ [key]: Number(e.target.value) / 100 })
              }
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-accent"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
