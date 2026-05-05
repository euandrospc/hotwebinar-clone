import { describe, it, expect, beforeEach } from "vitest";
import { signLeadCookie, verifyLeadCookie } from "@/lib/lead-session";

beforeEach(() => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
});

describe("lead-session", () => {
  it("signs and verifies a leadId roundtrip", () => {
    const cookie = signLeadCookie("lead-123");
    const result = verifyLeadCookie(cookie);
    expect(result).toBe("lead-123");
  });

  it("returns null for missing cookie", () => {
    expect(verifyLeadCookie(null)).toBeNull();
    expect(verifyLeadCookie(undefined)).toBeNull();
    expect(verifyLeadCookie("")).toBeNull();
  });

  it("returns null for malformed cookie", () => {
    expect(verifyLeadCookie("nodot")).toBeNull();
    expect(verifyLeadCookie(".only-id")).toBeNull();
    expect(verifyLeadCookie("only-sig.")).toBeNull();
  });

  it("returns null when signature does not match", () => {
    const cookie = signLeadCookie("lead-abc");
    const tampered = "ffffffffffffffffffffffffffffffff." + cookie.split(".")[1];
    expect(verifyLeadCookie(tampered)).toBeNull();
  });

  it("returns null when leadId is tampered", () => {
    const cookie = signLeadCookie("lead-abc");
    const tampered = cookie.split(".")[0] + ".lead-xyz";
    expect(verifyLeadCookie(tampered)).toBeNull();
  });

  it("throws when LEAD_SESSION_SECRET missing", () => {
    delete process.env.LEAD_SESSION_SECRET;
    expect(() => signLeadCookie("x")).toThrow(/LEAD_SESSION_SECRET/);
  });
});
