import { describe, it, expect } from "vitest";
import { extractJwtFromUserStorage } from "../../src/lib/auth.js";

describe("extractJwtFromUserStorage", () => {
  it("returns null when storage is empty", () => {
    expect(extractJwtFromUserStorage(null)).toBeNull();
    expect(extractJwtFromUserStorage("")).toBeNull();
    expect(extractJwtFromUserStorage("not-json")).toBeNull();
  });

  it("finds token at common keys", () => {
    expect(extractJwtFromUserStorage(JSON.stringify({ token: "abc" }))).toBe("abc");
    expect(extractJwtFromUserStorage(JSON.stringify({ accessToken: "def" }))).toBe("def");
    expect(extractJwtFromUserStorage(JSON.stringify({ jwt: "ghi" }))).toBe("ghi");
  });

  it("walks zustand-style { state: { token } } shapes", () => {
    const blob = JSON.stringify({ state: { user: { token: "zus" } }, version: 0 });
    expect(extractJwtFromUserStorage(blob)).toBe("zus");
  });

  it("returns null when no token-like field exists", () => {
    expect(extractJwtFromUserStorage(JSON.stringify({ name: "x" }))).toBeNull();
  });
});
