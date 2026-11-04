interface ConversationCapture {
  header: HTMLElement;
  messages: HTMLElement;
}

async function renderConversation({ header, messages }: ConversationCapture): Promise<Blob> {
  // Freeze the conversation at click time, without changing the visible scroll
  // position or including menus, the composer, and the rest of the inbox.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  Object.assign(host.style, { position: "fixed", left: "-100000px", top: "0", pointerEvents: "none" });
  const root = document.createElement("div");
  root.dataset.conversationSnapshot = "";
  const computed = getComputedStyle(messages);
  Object.assign(root.style, {
    width: `${Math.min(messages.clientWidth || 800, 960)}px`,
    backgroundColor: computed.backgroundColor,
    color: computed.color,
    font: computed.font,
    overflow: "visible"
  });
  const heading = header.cloneNode(true) as HTMLElement;
  heading.querySelectorAll("[data-screenshot-exclude]").forEach(node => node.remove());
  const history = messages.cloneNode(true) as HTMLElement;
  Object.assign(history.style, { height: "auto", minHeight: "0", maxHeight: "none", flex: "none", overflow: "visible" });
  root.append(heading, history);
  root.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
  host.append(root);
  document.body.append(host);
  try {
    await document.fonts?.ready;
    const { toBlob } = await import("html-to-image");
    const height = root.scrollHeight;
    const blob = await toBlob(root, {
      pixelRatio: Math.min(2, 16384 / Math.max(height, 1)),
      backgroundColor: computed.backgroundColor,
      // External preview images may refuse CORS; keep the readable link card.
      imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      preferredFontFormat: "woff2"
    });
    if (!blob || blob.size === 0) throw new Error("Não foi possível gerar o print da conversa.");
    return blob;
  } finally {
    host.remove();
  }
}

export async function copyConversationScreenshot(capture: ConversationCapture): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Este navegador não permite copiar imagens. Abra no Chrome, Edge ou Safari atualizado.");
  }
  const png = renderConversation(capture);
  // Start clipboard.write during the click, before async rendering, so browsers
  // that require transient user activation (including Safari) accept the write.
  void png.catch(() => {});
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
