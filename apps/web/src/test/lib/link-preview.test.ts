import { expect, it } from "vitest";
import { getLinkPreview, isPublicAddress, previewUrl } from "@/server/attendance/link-preview";
it("blocks private, loopback, metadata and IPv4-mapped private addresses", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "192.168.0.1", "169.254.169.254", "::1", "::ffff:127.0.0.1", "fe80::1"]) expect(isPublicAddress(ip)).toBe(false);
  expect(isPublicAddress("8.8.8.8")).toBe(true);
});
it("rejects unsupported protocols, credentials and custom ports", () => {
  for (const url of ["file:///etc/passwd", "http://user:pass@example.com", "http://example.com:5432"]) expect(() => previewUrl(url)).toThrow();
});
it("refuses metadata endpoints before issuing a request", async () => {
  await expect(getLinkPreview("http://169.254.169.254/latest/meta-data/")).rejects.toThrow("unsafe_address");
});
