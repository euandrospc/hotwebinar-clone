import { describe, it, expect } from "vitest";
import { hasRole, ATTENDANT_ROLES, ADMIN_ROLES } from "@/lib/roles";

describe("hasRole", () => {
  it("admin passes attendant and admin gates", () => {
    expect(hasRole("admin", ATTENDANT_ROLES)).toBe(true);
    expect(hasRole("admin", ADMIN_ROLES)).toBe(true);
  });
  it("attendant passes attendant gate but not admin gate", () => {
    expect(hasRole("attendant", ATTENDANT_ROLES)).toBe(true);
    expect(hasRole("attendant", ADMIN_ROLES)).toBe(false);
  });
  it("user and undefined and disabled fail both", () => {
    for (const r of ["user", undefined, "disabled"]) {
      expect(hasRole(r, ATTENDANT_ROLES)).toBe(false);
      expect(hasRole(r, ADMIN_ROLES)).toBe(false);
    }
  });
});
