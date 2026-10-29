import { describe, it, expect } from "vitest";
import { PRESETS } from "@/components/dashboard/dashboard-range-picker";

// Thu 2026-10-29, local time.
const now = new Date(2026, 9, 29, 15, 0);
const day = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const get = (label: string) => {
  const r = PRESETS.find((p) => p.label === label)!.range(now);
  return [day(r.from), day(r.to)];
};

describe("range presets", () => {
  it("computes each preset as whole days", () => {
    expect(get("Hoje")).toEqual(["2026-10-29", "2026-10-29"]);
    expect(get("Ontem")).toEqual(["2026-10-28", "2026-10-28"]);
    expect(get("Últimos 7 dias")).toEqual(["2026-10-23", "2026-10-29"]);
    expect(get("Semana passada")).toEqual(["2026-10-18", "2026-10-24"]); // Sun..Sat (ptBR)
    expect(get("Este mês")).toEqual(["2026-10-1", "2026-10-29"]);
    expect(get("Mês passado")).toEqual(["2026-9-1", "2026-9-30"]);
  });
});
