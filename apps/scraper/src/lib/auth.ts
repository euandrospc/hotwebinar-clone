import type { Page } from "playwright";

const TOKEN_KEYS = ["token", "accessToken", "jwt", "access_token", "id_token", "idToken"];

function findToken(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  for (const k of TOKEN_KEYS) {
    const v = (node as Record<string, unknown>)[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  for (const v of Object.values(node as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const found = findToken(v);
      if (found) return found;
    }
  }
  return null;
}

export function extractJwtFromUserStorage(raw: string | null): string | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return findToken(parsed);
}

export async function readUserStorage(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("user-storage"));
}

export async function readJwt(page: Page): Promise<string | null> {
  const raw = await readUserStorage(page);
  return extractJwtFromUserStorage(raw);
}
