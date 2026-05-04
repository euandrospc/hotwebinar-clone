import { describe, it, expect } from "vitest";
import { capturedFromResponse, type RequestLike, type ResponseLike } from "../../src/lib/network.js";

function fakeReq(over: Partial<RequestLike> = {}): RequestLike {
  return {
    url: () => "https://api.example.com/items/1",
    method: () => "GET",
    resourceType: () => "fetch",
    headers: () => ({ accept: "application/json" }),
    postData: () => null,
    ...over,
  };
}

function fakeResp(over: Partial<ResponseLike> = {}, req: RequestLike = fakeReq()): ResponseLike {
  return {
    request: () => req,
    status: () => 200,
    headers: () => ({ "content-type": "application/json" }),
    body: async () => Buffer.from(JSON.stringify({ id: 1 })),
    ...over,
  };
}

describe("network capture", () => {
  it("builds a Captured entry from a JSON response", async () => {
    const c = await capturedFromResponse(fakeResp(), { startedAt: 1000, now: () => 1234, bodyMaxChars: 200_000 });
    expect(c.url).toBe("https://api.example.com/items/1");
    expect(c.method).toBe("GET");
    expect(c.status).toBe(200);
    expect(c.requestBody).toBeNull();
    expect(c.responseBody).toBe('{"id":1}');
    expect(c.truncated).toBe(false);
    expect(c.timing).toBe(234);
  });

  it("truncates oversized bodies and flags them", async () => {
    const big = "x".repeat(500);
    const resp = fakeResp({ body: async () => Buffer.from(big) });
    const c = await capturedFromResponse(resp, { startedAt: 0, now: () => 0, bodyMaxChars: 100 });
    expect(c.responseBody!.length).toBe(100);
    expect(c.truncated).toBe(true);
  });

  it("skips body for binary content types", async () => {
    const resp = fakeResp({
      headers: () => ({ "content-type": "video/mp4" }),
      body: async () => Buffer.from([0, 1, 2, 3]),
    });
    const c = await capturedFromResponse(resp, { startedAt: 0, now: () => 0, bodyMaxChars: 100 });
    expect(c.responseBody).toBeNull();
    expect(c.truncated).toBe(false);
  });

  it("handles body() throwing (no body available)", async () => {
    const resp = fakeResp({
      body: async () => {
        throw new Error("no body");
      },
    });
    const c = await capturedFromResponse(resp, { startedAt: 0, now: () => 0, bodyMaxChars: 100 });
    expect(c.responseBody).toBeNull();
  });

  it("captures POST request body", async () => {
    const req = fakeReq({ method: () => "POST", postData: () => '{"a":1}' });
    const c = await capturedFromResponse(fakeResp({}, req), { startedAt: 0, now: () => 0, bodyMaxChars: 100 });
    expect(c.method).toBe("POST");
    expect(c.requestBody).toBe('{"a":1}');
  });
});
