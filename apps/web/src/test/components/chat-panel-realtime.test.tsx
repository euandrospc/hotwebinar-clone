import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatPanel } from "@/app/[slug]/_components/chat-panel";
import type { RealtimeEvent } from "@/lib/realtime-protocol";

const channel = vi.hoisted(() => ({
  onEvent: (_event: RealtimeEvent) => {}, onResync: () => {}
}));
vi.mock("@/lib/hooks/use-realtime-channel", () => ({
  useRealtimeChannel: (_scope: unknown, onEvent: typeof channel.onEvent, onResync: typeof channel.onResync) => {
    channel.onEvent = onEvent; channel.onResync = onResync;
    return { status: "connected", emitPresence: () => {} };
  }
}));

const currentTimeRef = { current: 30 };
const props = {
  audience: { mode: "NONE" as const, min: 0, max: 0, durationSec: 3600, seed: "test", currentTimeRef },
  ownerChat: [], leadChat: [], currentTimeSec: 30, leadName: "Ana", leadId: "lead", teamChatName: "Suporte",
  baseTimestampMs: Date.parse("2026-10-30T20:00:00Z"), salesNotifications: []
};
function message(id: string, text: string, clientMessageId?: string) {
  return { id, text, sender: "lead" as const, teamName: null, videoSec: 30, createdAt: "2026-10-30T20:00:30Z", clientMessageId };
}
function response(body: unknown, ok = true) { return { ok, json: async () => body } as Response; }
function write(text: string) {
  fireEvent.change(screen.getByPlaceholderText("Diga algo..."), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
}
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("instant public chat", () => {
  it("displays a team event immediately without waiting for a polling request", () => {
    render(<ChatPanel {...props} />);
    act(() => channel.onEvent({ type: "chat", leadId: "lead", webinarId: "webinar", message: { ...message("reply", "Estou aqui para ajudar"), sender: "team", videoSec: null } }));
    expect(screen.getByText("Estou aqui para ajudar")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("deduplicates a websocket acknowledgement arriving before the HTTP response", async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise((done) => { resolve = done; }) as Promise<Response>);
    render(<ChatPanel {...props} />);
    write("Minha pergunta");
    const sent = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    const saved = message("saved", "Minha pergunta", sent.clientMessageId);
    act(() => channel.onEvent({ type: "chat", leadId: "lead", webinarId: "webinar", message: saved }));
    await act(async () => resolve(response(saved)));
    expect(screen.getAllByText("Minha pergunta")).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("preserves a failed draft and retries the same request id", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({}, false) as Response).mockImplementationOnce(async (_url, init) => {
      const sent = JSON.parse(init!.body as string);
      return response(message("saved", sent.text, sent.clientMessageId)) as Response;
    });
    render(<ChatPanel {...props} />);
    write("Pode repetir?");
    await screen.findByRole("alert");
    expect(screen.getByPlaceholderText("Diga algo...")).toHaveValue("Pode repetir?");
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const bodies = vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(init!.body as string));
    expect(bodies[0].clientMessageId).toBe(bodies[1].clientMessageId);
    expect(screen.getAllByText("Pode repetir?")).toHaveLength(1);
  });

  it("recovers missed replies from the full conversation on reconnect", async () => {
    vi.mocked(fetch).mockResolvedValue(response({ messages: [{ ...message("missed", "Resposta enquanto caiu"), sender: "team", videoSec: null }] }) as Response);
    const view = render(<ChatPanel {...props} />);
    act(() => channel.onResync());
    await screen.findByText("Resposta enquanto caiu");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/lead-chat");
    const signal = vi.mocked(fetch).mock.calls[0][1]!.signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });

  it("keeps two identical messages sent as separate actions", async () => {
    let id = 0;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const sent = JSON.parse(init!.body as string);
      return response(message(`saved-${++id}`, sent.text, sent.clientMessageId)) as Response;
    });
    render(<ChatPanel {...props} />);
    await act(async () => write("Sim"));
    await act(async () => write("Sim"));
    expect(screen.getAllByText("Sim")).toHaveLength(2);
  });

  it("keeps a failed message accessible while the next draft is being written", async () => {
    let resolveFirst!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(async (_url, init) => {
        const sent = JSON.parse(init!.body as string);
        return response(message("saved", sent.text, sent.clientMessageId));
      });
    render(<ChatPanel {...props} />);
    write("Primeira mensagem");
    fireEvent.change(screen.getByPlaceholderText("Diga algo..."), { target: { value: "Próximo rascunho" } });
    await act(async () => resolveFirst(response({}, false)));
    expect(screen.getByPlaceholderText("Diga algo...")).toHaveValue("Próximo rascunho");
    expect(screen.getByRole("alert")).toHaveTextContent("Primeira mensagem");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reenviar: Primeira mensagem" })));
    expect(screen.getByPlaceholderText("Diga algo...")).toHaveValue("Próximo rascunho");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const attempts = vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(init!.body as string));
    expect(attempts[1].clientMessageId).toBe(attempts[0].clientMessageId);
    expect(screen.getAllByText("Primeira mensagem")).toHaveLength(1);
  });

  it("times out a stuck history request so a later resync can recover", async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    vi.mocked(fetch).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      signal = init!.signal as AbortSignal;
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })).mockResolvedValueOnce(response({ messages: [message("recovered", "Histórico recuperado")] }));
    render(<ChatPanel {...props} />);
    act(() => channel.onResync());
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(signal.aborted).toBe(true);
    await act(async () => channel.onResync());
    expect(screen.getByText("Histórico recuperado")).toBeInTheDocument();
  });
});
