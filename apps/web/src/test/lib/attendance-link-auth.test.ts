import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";

describe("conversation links through authentication", () => {
  it("preserves the selected conversation in the login return URL", () => {
    const result = middleware(new NextRequest("https://lives.example/atendimento?leadId=conversation-123"));
    const target = new URL(result.headers.get("location")!);
    expect(target.pathname).toBe(ADMIN_LOGIN_PATH);
    expect(target.searchParams.get("from")).toBe("/atendimento?leadId=conversation-123");
  });
  it("allows authenticated staff to continue to server authorization", () => {
    const request = new NextRequest("https://lives.example/atendimento?leadId=conversation-123", { headers: { cookie: "better-auth.session_token=test-session" } });
    expect(middleware(request).headers.get("location")).toBeNull();
  });
});
