import { describe, it, expect } from "vitest";
import { step7Schema } from "@/lib/validations/webinar";

const VALID = {
  notifications: [
    { showAtSec: 60, buyerName: "João", productName: "Curso A", price: "R$ 297" },
    { showAtSec: 120, buyerName: "Maria", productName: "Mentoria", price: null }
  ]
};

describe("step7Schema", () => {
  it("accepts valid notifications", () => {
    expect(step7Schema.safeParse(VALID).success).toBe(true);
  });
  it("accepts empty notifications array", () => {
    expect(step7Schema.safeParse({ notifications: [] }).success).toBe(true);
  });
  it("rejects empty buyerName", () => {
    expect(step7Schema.safeParse({ notifications: [{ ...VALID.notifications[0], buyerName: "" }] }).success).toBe(false);
  });
  it("rejects empty productName", () => {
    expect(step7Schema.safeParse({ notifications: [{ ...VALID.notifications[0], productName: "" }] }).success).toBe(false);
  });
  it("rejects negative showAtSec", () => {
    expect(step7Schema.safeParse({ notifications: [{ ...VALID.notifications[0], showAtSec: -1 }] }).success).toBe(false);
  });
  it("treats price as optional + nullable", () => {
    const r = step7Schema.safeParse({ notifications: [{ showAtSec: 0, buyerName: "X", productName: "Y" }] });
    expect(r.success).toBe(true);
  });
});
