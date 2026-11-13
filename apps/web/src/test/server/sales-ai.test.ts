import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSalePhrases, offerWindow, spreadTimes, toSaleRows } from "@/server/sales-ai";

const w = { title: "W", offerName: "Curso", offerTitle: "", offerPriceFinal: null, offerShowAtSec: 6000, offerHideAtSec: 6600, pitchAtSec: null, durationSec: 7200 };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("sales AI", () => {
  it("keeps generated times inside the offer window, increasing", () => {
    const times = spreadTimes(20, offerWindow(w));
    expect(times).toHaveLength(20);
    times.forEach((t, i) => { expect(t).toBeGreaterThanOrEqual(6000); expect(t).toBeLessThanOrEqual(6600); if (i) expect(t).toBeGreaterThan(times[i - 1]); });
    expect(offerWindow({ ...w, offerShowAtSec: null, offerHideAtSec: null, pitchAtSec: 100 })).toEqual([100, 7200]);
  });
  it("builds placeholder rows", () => {
    expect(toSaleRows(["comprou o curso."], [10])[0]).toEqual({ showAtSec: 10, buyerName: "{comprador}{origem} comprou o curso.", productName: "", price: null });
  });
  it("rejects missing key and invalid provider output", async () => {
    await expect(generateSalePhrases("m", w)).rejects.toMatchObject({ code: "provider_missing" });
    vi.stubEnv("OPENAI_API_KEY", "test-not-a-secret");
    const reply = (phrases: unknown) => new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ phrases }) }] }] }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(["{x} hack"])).mockResolvedValueOnce(reply(["comprou o curso."])));
    await expect(generateSalePhrases("m", w)).rejects.toMatchObject({ code: "invalid_output" });
    await expect(generateSalePhrases("m", w)).resolves.toEqual(["comprou o curso."]);
  });
});
