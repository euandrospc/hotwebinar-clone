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
