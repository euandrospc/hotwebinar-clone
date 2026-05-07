export interface Avatar {
  letters: string;
  backgroundColor: string;
  textColor: string;
}

const PALETTE: ReadonlyArray<{ bg: string; text: string }> = [
  { bg: "#2563eb", text: "#ffffff" },
  { bg: "#16a34a", text: "#ffffff" },
  { bg: "#dc2626", text: "#ffffff" },
  { bg: "#7c3aed", text: "#ffffff" },
  { bg: "#ea580c", text: "#ffffff" },
  { bg: "#0891b2", text: "#ffffff" },
  { bg: "#4f46e5", text: "#ffffff" },
  { bg: "#be123c", text: "#ffffff" },
  { bg: "#1e293b", text: "#ffffff" },
  { bg: "#854d0e", text: "#ffffff" },
  { bg: "#0d9488", text: "#ffffff" },
  { bg: "#9333ea", text: "#ffffff" },
  { bg: "#0369a1", text: "#ffffff" },
  { bg: "#b91c1c", text: "#ffffff" },
  { bg: "#15803d", text: "#ffffff" },
  { bg: "#6b21a8", text: "#ffffff" },
  { bg: "#c2410c", text: "#ffffff" },
  { bg: "#1d4ed8", text: "#ffffff" },
  { bg: "#be185d", text: "#ffffff" },
  { bg: "#115e59", text: "#ffffff" },
  { bg: "#86198f", text: "#ffffff" },
  { bg: "#7e22ce", text: "#ffffff" },
  { bg: "#0f766e", text: "#ffffff" },
  { bg: "#166534", text: "#ffffff" },
  { bg: "#4338ca", text: "#ffffff" },
  { bg: "#9f1239", text: "#ffffff" },
  { bg: "#1e40af", text: "#ffffff" },
  { bg: "#701a75", text: "#ffffff" },
  { bg: "#065f46", text: "#ffffff" }
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = (hash << 5) - hash + c;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function generateAvatar(str: string | null | undefined): Avatar | null {
  if (!str) return null;
  const words = str.trim().split(/\s+/);
  if (words.length === 0 || words[0] === "") return null;

  let first: string;
  let second: string;
  if (words.length === 1) {
    first = words[0].charAt(0) || "";
    second = words[0].charAt(1) || "";
  } else {
    first = words[0].charAt(0);
    second = words[words.length - 1].charAt(0);
  }

  const { bg, text } = PALETTE[hashCode(str) % PALETTE.length];
  return {
    letters: `${first}${second}`.toUpperCase(),
    backgroundColor: bg,
    textColor: text
  };
}
