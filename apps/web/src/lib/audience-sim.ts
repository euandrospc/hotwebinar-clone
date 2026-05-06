export type AudienceMode = "NONE" | "FIXED" | "DYNAMIC";

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return Math.abs(h | 0);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function simulateAudienceAt(
  t: number,
  duration: number,
  min: number,
  max: number,
  seed: string,
  mode: AudienceMode = "DYNAMIC"
): number {
  if (max <= min) return min;
  const h = hashSeed(seed);
  if (mode === "FIXED") {
    return min + (h % (max - min + 1));
  }
  const norm = duration > 0 ? Math.min(t / duration, 1) : 0;
  const envelope =
    norm < 0.3 ? norm / 0.3
    : norm < 0.8 ? 1
    : 1 - ((norm - 0.8) / 0.2) * 0.2;
  const jitter = Math.sin((t + h) * 0.13) * 0.05;
  const range = max - min;
  return Math.round(min + range * clamp01(envelope + jitter));
}

export function simulateAudienceSeries(
  duration: number,
  min: number,
  max: number,
  seed: string,
  mode: AudienceMode = "DYNAMIC",
  samples = 60
): Array<{ t: number; count: number }> {
  const out: Array<{ t: number; count: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const t = (duration / samples) * i;
    out.push({ t, count: simulateAudienceAt(t, duration, min, max, seed, mode) });
  }
  return out;
}
