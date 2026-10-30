import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Inbox } from "@/app/atendimento/_components/inbox";
import type { RealtimeEvent } from "@/lib/realtime-protocol";

const channel = vi.hoisted(() => ({ onEvent: (_event: RealtimeEvent) => {}, onResync: () => {} }));
vi.mock("@/lib/hooks/use-realtime-channel", () => ({
  useRealtimeChannel: (_scope: unknown, onEvent: typeof channel.onEvent, onResync: typeof channel.onResync) => {
    channel.onEvent = onEvent; channel.onResync = onResync;
    return { status: "connected", emitPresence: () => {} };
  }
}));
vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));

const conversations = [
  { leadId: "ana", leadName: "Ana", leadPhone: null, webinarId: "webinar", webinarTitle: "Aula", webinarPhase: "open", webinarStartDate: null, lastText: "Conversa da Ana", lastAt: "2026-10-30T20:00:00Z", pending: true, online: true },
  { leadId: "bruno", leadName: "Bruno", leadPhone: null, webinarId: "webinar", webinarTitle: "Aula", webinarPhase: "open", webinarStartDate: null, lastText: "Conversa do Bruno", lastAt: "2026-10-30T20:00:00Z", pending: true, online: true }
];
function message(id: string, text: string, sender: "lead" | "team" = "lead", clientMessageId?: string) {
  return { id, text, sender, teamName: sender === "team" ? "Equipe" : null, videoSec: null, createdAt: "2026-10-30T20:00:30Z", clientMessageId };
}
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const log = () => within(screen.getByRole("log", { name: "Mensagens da conversa" }));
const composer = () => screen.getByPlaceholderText("Escreva uma resposta...");
async function select(name: string) { await act(async () => { fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name.slice(0, 1)} ${name} `) })); }); }

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
    if (String(url).includes("conversations")) return response({ conversations, onlineTotal: 2 });
    return response({ messages: [] });
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function openInbox(name = "Ana") {
  const view = render(<Inbox attendantName="Equipe" />);
  await screen.findByText("Conversa da Ana");
  await select(name);
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes(`leadId=${name === "Ana" ? "ana" : "bruno"}`))).toBe(true));
  return view;
}

describe("instant attendant inbox", () => {
  it("keeps drafts separate and only displays events for the selected conversation", async () => {
    await openInbox();
    fireEvent.change(composer(), { target: { value: "Rascunho da Ana" } });
    await select("Bruno");
    expect(composer()).toHaveValue("");
    fireEvent.change(composer(), { target: { value: "Rascunho do Bruno" } });
    act(() => channel.onEvent({ type: "chat", leadId: "ana", webinarId: "webinar", message: message("a", "Mensagem privada da Ana") }));
    expect(log().queryByText("Mensagem privada da Ana")).not.toBeInTheDocument();
    act(() => channel.onEvent({ type: "chat", leadId: "bruno", webinarId: "webinar", message: message("b", "Mensagem instantânea do Bruno") }));
    expect(log().getByText("Mensagem instantânea do Bruno")).toBeInTheDocument();
    await select("Ana");
    expect(composer()).toHaveValue("Rascunho da Ana");
    await select("Bruno");
    expect(composer()).toHaveValue("Rascunho do Bruno");
  });

  it("discards a delayed HTTP response after switching contacts", async () => {
    let resolveAna!: (value: Response) => void;
    let oldSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).includes("conversations")) return response({ conversations, onlineTotal: 2 });
      if (String(url).includes("leadId=ana")) {
        oldSignal = init?.signal as AbortSignal;
        return new Promise((resolve) => { resolveAna = resolve; });
      }
      return response({ messages: [message("b", "Histórico do Bruno")] });
    });
    await openInbox();
    await select("Bruno");
    await screen.findByText("Histórico do Bruno");
    await act(async () => resolveAna(response({ messages: [message("a", "Histórico atrasado da Ana")] })));
    expect(oldSignal?.aborted).toBe(true);
    expect(log().queryByText("Histórico atrasado da Ana")).not.toBeInTheDocument();
    expect(log().getByText("Histórico do Bruno")).toBeInTheDocument();
  });

  it("merges a reply delivered by websocket before its HTTP acknowledgement", async () => {
    let resolveReply!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes("conversations")) return response({ conversations, onlineTotal: 2 });
      if (String(url).includes("/reply")) return new Promise((resolve) => { resolveReply = resolve; });
      return response({ messages: [] });
    });
    await openInbox();
    fireEvent.change(composer(), { target: { value: "Posso ajudar" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/reply"))!;
    const sent = JSON.parse(call[1]!.body as string);
    const saved = message("reply", "Posso ajudar", "team", sent.clientMessageId);
    act(() => channel.onEvent({ type: "chat", leadId: "ana", webinarId: "webinar", message: saved }));
    await act(async () => resolveReply(response(saved)));
    expect(log().getAllByText("Posso ajudar")).toHaveLength(1);
  });

  it("restores a failed reply to its own contact without clearing a different draft", async () => {
    let resolveReply!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes("conversations")) return response({ conversations, onlineTotal: 2 });
      if (String(url).includes("/reply")) return new Promise((resolve) => { resolveReply = resolve; });
      return response({ messages: [] });
    });
    await openInbox();
    fireEvent.change(composer(), { target: { value: "Resposta da Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    await select("Bruno");
    fireEvent.change(composer(), { target: { value: "Novo rascunho do Bruno" } });
    await act(async () => resolveReply(response({}, false)));
    expect(composer()).toHaveValue("Novo rascunho do Bruno");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await select("Ana");
    expect(composer()).toHaveValue("Resposta da Ana");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("resynchronizes the selected thread after reconnect and cancels it on unmount", async () => {
    const view = await openInbox();
    vi.mocked(fetch).mockImplementation(async (url) => String(url).includes("conversations")
      ? response({ conversations, onlineTotal: 2 })
      : response({ messages: [message("recovered", "Mensagem perdida durante a conexão")] }));
    act(() => channel.onResync());
    await screen.findByText("Mensagem perdida durante a conexão");
    const latestThread = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/thread")).at(-1)!;
    view.unmount();
    expect((latestThread[1]!.signal as AbortSignal).aborted).toBe(true);
  });

  it("preserves the scroll position when reading older messages", async () => {
    await openInbox();
    const element = screen.getByRole("log");
    Object.defineProperties(element, { scrollHeight: { value: 1000 }, clientHeight: { value: 300 } });
    element.scrollTop = 120;
    fireEvent.scroll(element);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    act(() => channel.onEvent({ type: "chat", leadId: "ana", webinarId: "webinar", message: message("new", "Chegou agora") }));
    expect(log().getByText("Chegou agora")).toBeInTheDocument();
    expect(element.scrollTop).toBe(120);
  });

  it("keeps a failed reply available without overwriting the next draft in the same contact", async () => {
    let resolveFirst!: (value: Response) => void;
    let replies = 0;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).includes("conversations")) return response({ conversations, onlineTotal: 2 });
      if (String(url).includes("/reply")) {
        if (++replies === 1) return new Promise((resolve) => { resolveFirst = resolve; });
        const sent = JSON.parse(init!.body as string);
        return response(message("saved", sent.text, "team", sent.clientMessageId));
      }
      return response({ messages: [] });
    });
    await openInbox();
    fireEvent.change(composer(), { target: { value: "Resposta original" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    fireEvent.change(composer(), { target: { value: "Novo rascunho" } });
    await act(async () => resolveFirst(response({}, false)));
    expect(composer()).toHaveValue("Novo rascunho");
    expect(screen.getByRole("alert")).toHaveTextContent("Resposta original");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reenviar resposta: Resposta original" })));
    expect(composer()).toHaveValue("Novo rascunho");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const attempts = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/reply")).map(([, init]) => JSON.parse(init!.body as string));
    expect(attempts[1].clientMessageId).toBe(attempts[0].clientMessageId);
    expect(log().getAllByText("Resposta original")).toHaveLength(1);
  });

  it("releases a stuck conversations request and runs the queued resync after timeout", async () => {
    vi.useFakeTimers();
    let firstSignal!: AbortSignal;
    vi.mocked(fetch).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      firstSignal = init!.signal as AbortSignal;
      firstSignal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })).mockResolvedValueOnce(response({ conversations, onlineTotal: 2 }));
    render(<Inbox attendantName="Equipe" />);
    act(() => channel.onResync());
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(firstSignal.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Conversa da Ana")).toBeInTheDocument();
  });
});
