import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ allocate: vi.fn() }));
vi.mock("@/server/ab-tests/assignment", () => ({ allocateAbVisitor: mocks.allocate }));
vi.mock("@/server/ab-tests/experiments", () => ({ AbTestError: class extends Error { constructor(public code: string, public status: number, message?: string) { super(message ?? code); } } }));
import { GET, HEAD } from "@/app/ab/[id]/route";
import { AB_VISITOR_COOKIE, abAssignmentCookieName, signAbVisitor, verifyAbAssignment, verifyAbVisitor } from "@/lib/ab-test-cookie";
import { AbTestError } from "@/server/ab-tests/experiments";

beforeEach(() => {
  vi.stubEnv("LEAD_SESSION_SECRET", "test-secret-at-least-16-characters");
  mocks.allocate.mockReset().mockResolvedValue({ assignmentId: "assignment-1", webinarId: "b", slug: "webinar-b", variant: "B" });
});
afterEach(() => vi.unstubAllEnvs());
const context = () => ({ params: Promise.resolve({ id: "experiment-1" }) });

describe("public experiment link", () => {
  it("redirects only to the stored webinar and carries allowed marketing params, never a user-supplied assignment/destination", async () => {
    const response = await GET(new NextRequest("https://app.test/ab/experiment-1?utm_source=meta&utm_content=creative&next=https://evil.test&assignmentId=forged&variant=A"), context());
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.test/webinar-b?utm_source=meta&utm_content=creative");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(verifyAbAssignment(response.cookies.get(abAssignmentCookieName("b"))?.value)).toBe("assignment-1");
    expect(verifyAbVisitor(response.cookies.get(AB_VISITOR_COOKIE)?.value)).toBeTruthy();
    expect(response.cookies.get(AB_VISITOR_COOKIE)).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });
  it("reuses a verified browser id and replaces forged tokens", async () => {
    const request = (cookie: string) => new NextRequest("https://app.test/ab/experiment-1", { headers: { cookie: `${AB_VISITOR_COOKIE}=${cookie}` } });
    await GET(request(signAbVisitor("existing-browser")), context());
    expect(mocks.allocate.mock.calls[0][1]).toBe("existing-browser");
    await GET(request("existing-browser.forged"), context());
    expect(mocks.allocate.mock.calls[1][1]).not.toBe("existing-browser");
  });
  it("does not enroll HEAD, prefetch or known link preview agents", async () => {
    expect((await HEAD()).status).toBe(204);
    const previewHeaders: Record<string, string>[] = [{ purpose: "prefetch" }, { "sec-purpose": "prefetch;prerender" }, { "user-agent": "WhatsApp/2.0" }, { "user-agent": "Googlebot" }, { "user-agent": "facebookexternalhit/1.1" }];
    for (const headers of previewHeaders) {
      expect((await GET(new NextRequest("https://app.test/ab/experiment-1", { headers }), context())).status).toBe(204);
    }
    expect(mocks.allocate).not.toHaveBeenCalled();
  });
  it("returns an unavailable message without disclosing unexpected database errors", async () => {
    mocks.allocate.mockRejectedValueOnce(new AbTestError("allocation_closed", 409, "Coleta pausada."));
    const paused = await GET(new NextRequest("https://app.test/ab/experiment-1"), context());
    expect(paused.status).toBe(409); expect(await paused.text()).toBe("Coleta pausada.");
    mocks.allocate.mockRejectedValueOnce(new Error("secret database URL"));
    const error = await GET(new NextRequest("https://app.test/ab/experiment-1"), context());
    expect(error.status).toBe(503); expect(await error.text()).not.toContain("secret");
  });
});
