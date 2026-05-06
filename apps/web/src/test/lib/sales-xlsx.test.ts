import { describe, it, expect } from "vitest";
import { parseSalesXlsx, buildSalesXlsx, type ParsedSale } from "@/lib/sales-xlsx";

const SAMPLE: ParsedSale[] = [
  { showAtSec: 0, buyerName: "Ana", productName: "Curso A", price: "R$ 297" },
  { showAtSec: 65, buyerName: "Bruno", productName: "Mentoria", price: null },
  { showAtSec: 3725, buyerName: "Carla", productName: "Combo", price: "12x R$ 47" }
];

describe("sales-xlsx", () => {
  it("buildSalesXlsx round-trips through parseSalesXlsx", async () => {
    const buf = await buildSalesXlsx(SAMPLE);
    const parsed = await parseSalesXlsx(buf);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({ ...SAMPLE[0], price: "R$ 297" });
    expect(parsed[1].price).toBeNull();
    expect(parsed[2].showAtSec).toBe(3725);
  });
  it("skips rows missing buyerName or productName", async () => {
    const buf = await buildSalesXlsx([
      { showAtSec: 0, buyerName: "", productName: "X", price: null },
      { showAtSec: 10, buyerName: "Y", productName: "", price: null },
      { showAtSec: 20, buyerName: "OK", productName: "Z", price: null }
    ]);
    const parsed = await parseSalesXlsx(buf);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].buyerName).toBe("OK");
  });
});
