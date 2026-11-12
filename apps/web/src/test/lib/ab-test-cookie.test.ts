import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abAssignmentCookieName, signAbAssignment, signAbVisitor, verifyAbAssignment, verifyAbVisitor } from "@/lib/ab-test-cookie";

beforeEach(() => vi.stubEnv("LEAD_SESSION_SECRET", "ab-tests-secret-at-least-16-characters"));
afterEach(() => vi.unstubAllEnvs());

describe("experiment cookies", () => {
  it("uses different signing domains for browser and assignment identity", () => {
    expect(verifyAbVisitor(signAbVisitor("browser-123"))).toBe("browser-123");
    expect(verifyAbAssignment(signAbAssignment("assignment-123"))).toBe("assignment-123");
    expect(verifyAbVisitor(signAbAssignment("browser-123"))).toBeNull();
    expect(verifyAbAssignment(signAbVisitor("assignment-123"))).toBeNull();
  });
  it("rejects tampering, malformed and oversized tokens", () => {
    expect(verifyAbAssignment(signAbAssignment("original").replace("original", "different"))).toBeNull();
    for (const token of [null, undefined, "", "a.b", "x".repeat(257), `a.${"a".repeat(64)}.extra`]) expect(verifyAbAssignment(token)).toBeNull();
  });
  it("keeps one safe cookie namespace per webinar", () => {
    expect(abAssignmentCookieName("a")).not.toBe(abAssignmentCookieName("b"));
    expect(abAssignmentCookieName("a")).toMatch(/^hw_ab_[a-f0-9]{20}$/);
    expect(abAssignmentCookieName("a")).toBe(abAssignmentCookieName("a"));
  });
  it("fails closed without a signing secret", () => {
    vi.stubEnv("LEAD_SESSION_SECRET", "short");
    expect(() => signAbVisitor("browser")).toThrow();
  });
});
