import { describe, expect, it } from "vitest";
import { sameOriginPath } from "@/lib/sso-redirect";

const base = "https://lives.bravy.com.br";

describe("sameOriginPath", () => {
  it("keeps internal paths with query and hash", () => {
    expect(sameOriginPath("/dashboard/webinars?tab=leads#top", base)).toBe("/dashboard/webinars?tab=leads#top");
    expect(sameOriginPath(`${base}/atendimento`, base)).toBe("/atendimento");
  });

  it("falls back when missing", () => {
    expect(sameOriginPath(null, base)).toBe("/dashboard");
    expect(sameOriginPath("", base)).toBe("/dashboard");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "javascript:alert(1)"])(
    "rejects off-site target %j",
    (next) => {
      expect(sameOriginPath(next, base)).toBe("/dashboard");
    }
  );
});
