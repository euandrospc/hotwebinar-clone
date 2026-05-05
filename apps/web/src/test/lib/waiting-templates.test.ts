import { describe, it, expect } from "vitest";
import { WAITING_TEMPLATES, type WaitingTemplateId } from "@/lib/waiting-templates";

describe("waiting-templates", () => {
  it("has 5 templates", () => {
    expect(WAITING_TEMPLATES).toHaveLength(5);
  });

  it("includes DEFAULT, WITH_THUMB, IMMERSIVE, MINIMAL, FEATURES", () => {
    const ids = WAITING_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(["DEFAULT", "WITH_THUMB", "IMMERSIVE", "MINIMAL", "FEATURES"]);
  });

  it("each template has label + description", () => {
    for (const t of WAITING_TEMPLATES) {
      expect(typeof t.label).toBe("string");
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe("string");
    }
  });
});
