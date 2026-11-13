import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatTimes, chatWindow, generateChatScript, toChatRows } from "@/server/chat-script-ai";

const webinar = { title: "Dominando Claude Code", offerName: "Curso", offerTitle: "", pitchAtSec: 3600, durationSec: 7200 };
const provider = vi.fn();
beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "test-not-a-secret"); vi.stubGlobal("fetch", provider); provider.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function result(value: unknown) {
  return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] }), { status: 200 });
}

describe("chat script AI", () => {
  it("spreads times through the video, strictly increasing", () => {
    const times = chatTimes(webinar, 40);
    expect(times).toHaveLength(40);
    expect(times[0]).toBeGreaterThanOrEqual(5);
    expect(times.at(-1)).toBeLessThanOrEqual(chatWindow(webinar)[1]);
    expect(times.every((t, i) => i === 0 || t > times[i - 1])).toBe(true);
  });

  it("keeps a short answer spread over the whole window", () => {
    const rows = toChatRows([{ author: "Ana", text: "Oi" }, { author: "Bia", text: "Boa" }], [10, 20, 30, 40]);
    expect(rows.map((r) => r.showAtSec)).toEqual([10, 30]);
    expect(rows[0]).toEqual({ authorName: "Ana", text: "Oi", showAtSec: 10, isOwner: false });
  });

  it("tells the model which messages come after the pitch and validates output", async () => {
    provider.mockResolvedValue(result({ messages: [{ author: "Ana", text: "Boa tarde!" }] }));
    const out = await generateChatScript("gpt", webinar, [100, 4000]);
    expect(out).toEqual([{ author: "Ana", text: "Boa tarde!" }]);
    expect(JSON.parse(provider.mock.calls[0][1].body).instructions).toContain("As mensagens 2 a 2 acontecem depois");
  });

  it("rejects malformed output and a missing key", async () => {
    provider.mockResolvedValue(result({ messages: [{ author: "", text: "x" }] }));
    await expect(generateChatScript("gpt", webinar, [1])).rejects.toMatchObject({ code: "invalid_output" });
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(generateChatScript("gpt", webinar, [1])).rejects.toMatchObject({ code: "provider_missing", status: 409 });
  });
});
