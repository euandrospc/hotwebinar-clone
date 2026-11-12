import { describe, expect, it } from "vitest";
import { canAccessVideo, canAccessWebinar, isAdminUser, ownerScope } from "@/lib/webinar-access";

const webinar = { id: "w1", ownerId: "creator" };
const session = (id: string, role?: string) => ({ user: { id, role } });

describe("webinar access", () => {
  it("keeps creators' access and lets admins access webinars and videos they did not create", () => {
    expect(canAccessWebinar(session("creator", "admin"), webinar)).toBe(true);
    expect(canAccessWebinar(session("other-admin", "admin"), webinar)).toBe(true);
    expect(canAccessVideo({ id: "other-admin", role: "admin" }, { ownerId: "creator" })).toBe(true);
    expect(isAdminUser(session("other-admin", "admin"))).toBe(true);
  });

  it("does not widen access for attendant, disabled, default or missing roles", () => {
    for (const role of ["attendant", "disabled", "user", undefined]) {
      expect(canAccessWebinar(session("someone", role), webinar)).toBe(false);
      expect(canAccessWebinar(session("creator", role), webinar)).toBe(true);
      expect(ownerScope(session("someone", role))).toEqual({ ownerId: "someone" });
    }
    expect(canAccessWebinar(session("creator", "ADMIN"), { ownerId: "x" })).toBe(false);
  });

  it("rejects missing resources and scopes admin queries to everything", () => {
    expect(canAccessWebinar(session("admin", "admin"), null)).toBe(false);
    expect(canAccessVideo(session("admin", "admin"), undefined)).toBe(false);
    expect(ownerScope(session("admin", "admin"))).toEqual({});
    expect(() => ownerScope(session(""))).toThrow("Authenticated user is required");
  });
});
