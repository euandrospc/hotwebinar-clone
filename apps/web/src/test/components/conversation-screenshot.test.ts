import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { copyConversationScreenshot } from "@/lib/conversation-screenshot";
const render = vi.hoisted(() => ({ toBlob: vi.fn() }));
vi.mock("html-to-image", () => ({ toBlob: render.toBlob }));
const blob = new Blob(["test-png"], { type: "image/png" });
let write: ReturnType<typeof vi.fn>;
class Item {
  constructor(public data: Record<string, Promise<Blob>>) {}
}
function capture() {
  const header = document.createElement("div");
  header.innerHTML = '<span>Ana · Webinar</span><button data-screenshot-exclude>Copiar print</button>';
  const messages = document.createElement("div");
  messages.innerHTML = '<p>Primeira mensagem</p><p>Última mensagem</p>';
  messages.style.overflow = "auto"; messages.style.height = "100px";
  messages.scrollTop = 80;
  return { header, messages };
}
beforeEach(() => {
  render.toBlob.mockReset().mockResolvedValue(blob);
  write = vi.fn(async (items: Item[]) => { await items[0].data["image/png"]; });
  vi.stubGlobal("ClipboardItem", Item);
  vi.stubGlobal("navigator", { clipboard: { write } });
});
afterEach(() => { document.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove()); vi.unstubAllGlobals(); });
it("writes PNG during the click and captures the full frozen history without controls or changing scroll", async () => {
  const source = capture();
  render.toBlob.mockImplementation(async (root: HTMLElement) => {
    expect(root.textContent).toContain("Ana · Webinar");
    expect(root.textContent).toContain("Primeira mensagem");
    expect(root.textContent).toContain("Última mensagem");
    expect(root.textContent).not.toContain("Copiar print");
    expect(root.lastElementChild).toHaveStyle({ height: "auto", overflow: "visible" });
    return blob;
  });
  const operation = copyConversationScreenshot(source);
  expect(write).toHaveBeenCalledTimes(1);
  source.header.textContent = "Outro contato";
  await operation;
  expect(source.messages.scrollTop).toBe(80);
  expect(document.querySelector('[data-conversation-snapshot]')).toBeNull();
});
it.each([
  { theme: "light", canvas: "#f8faf7", surface: "#ffffff", ink: "#20362b" },
  { theme: "dark", canvas: "#0e1712", surface: "#111b16", ink: "#e0eae2" },
])("preserves $theme workspace tokens outside their original container", async ({ canvas, surface, ink }) => {
  const source = capture();
  // JSDOM does not inherit CSS custom properties from ancestors. Defining them
  // on the source reproduces the computed values supplied by the real browser.
  source.messages.style.setProperty("--inbox-canvas", canvas);
  source.messages.style.setProperty("--inbox-surface", surface);
  source.messages.style.setProperty("--inbox-ink", ink);
  source.header.style.backgroundColor = "var(--inbox-surface)";
  source.header.style.color = "var(--inbox-ink)";
  render.toBlob.mockImplementation(async (root: HTMLElement) => {
    expect(root.style.getPropertyValue("--inbox-canvas")).toBe(canvas);
    expect(root.style.getPropertyValue("--inbox-surface")).toBe(surface);
    expect(root.style.getPropertyValue("--inbox-ink")).toBe(ink);
    expect((root.firstElementChild as HTMLElement).style.backgroundColor).toBe("var(--inbox-surface)");
    expect((root.firstElementChild as HTMLElement).style.color).toBe("var(--inbox-ink)");
    return blob;
  });
  const operation = copyConversationScreenshot(source);
  source.messages.style.setProperty("--inbox-surface", "red");
  await operation;
});
it("stops cloned entrance animations before rendering without changing the live conversation", async () => {
  const source = capture();
  source.header.style.animation = "header-in 200ms both";
  const message = source.messages.firstElementChild as HTMLElement;
  message.style.setProperty("animation", "message-in 180ms both", "important");
  message.style.transition = "opacity 200ms";
  render.toBlob.mockImplementation(async (root: HTMLElement) => {
    for (const node of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
      expect(node.style.animation).toBe("none");
      expect(node.style.getPropertyPriority("animation")).toBe("important");
      expect(node.style.transition).toBe("none");
    }
    return blob;
  });
  await copyConversationScreenshot(source);
  expect(source.header.style.animation).toBe("header-in 200ms both");
  expect(message.style.animation).toBe("message-in 180ms both");
  expect(message.style.transition).toBe("opacity 200ms");
});
it("reports rendering failures and removes the temporary copy", async () => {
  render.toBlob.mockRejectedValue(new Error("render failed"));
  await expect(copyConversationScreenshot(capture())).rejects.toThrow("render failed");
  expect(document.querySelector('[data-conversation-snapshot]')).toBeNull();
});
it("reports denied clipboard permissions without claiming success", async () => {
  write.mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
  await expect(copyConversationScreenshot(capture())).rejects.toMatchObject({ name: "NotAllowedError" });
  await waitFor(() => expect(document.querySelector('[data-conversation-snapshot]')).toBeNull());
});
it("explains unsupported browsers before rendering", async () => {
  vi.stubGlobal("ClipboardItem", undefined);
  await expect(copyConversationScreenshot(capture())).rejects.toThrow("não permite copiar imagens");
  expect(render.toBlob).not.toHaveBeenCalled();
});
