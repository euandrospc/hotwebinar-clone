import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardChatIntelligence } from "@/components/dashboard/dashboard-chat-intelligence";
import type { ChatInsightCategory, ChatIntelligenceReport } from "@/lib/dashboard-chat-intelligence";

const from = "2026-11-10T03:00:00.000Z";
const to = "2026-11-11T02:59:59.999Z";
const scope = { webinarId: "owned-webinar", from, to };
const category = (id: string, label: string, count = 3): ChatInsightCategory => ({
  id, label, guidance: "Esclarecer as condições reais da oferta.", messageCount: count,
  conversationCount: Math.min(2, count), percentage: 75,
  examples: [{ id: `message-${id}`, leadId: "lead 1", text: "Achei o valor alto para meu orçamento.", createdAt: "2026-11-10T15:30:00.000Z" }]
});
const report = (changes: Partial<ChatIntelligenceReport> = {}): ChatIntelligenceReport => ({
  webinarId: scope.webinarId, providerReady: true, isProcessing: false,
  totalMessages: 10, analyzedMessages: 10, pendingMessages: 0,
  objectionMessages: 4, questionMessages: 4, neutralMessages: 4,
  lastAnalyzedAt: "2026-11-10T16:00:00.000Z",
  objections: [category("price", "Preço e orçamento"), category("time", "Falta de tempo", 2)],
  questions: [category("recordings", "As aulas ficam gravadas?")],
  ...changes
});
const pending = (changes: Partial<ChatIntelligenceReport> = {}) => report({
  analyzedMessages: 0, pendingMessages: 10, objectionMessages: 0, questionMessages: 0,
  neutralMessages: 0, lastAnalyzedAt: null, objections: [], questions: [], ...changes
});
const jsonResponse = (body: unknown, status = 200) => Promise.resolve({
  ok: status >= 200 && status < 300, status, json: async () => body
} as Response);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}
const fetchMock = vi.fn<typeof fetch>();
const methodCalls = (method: string) => fetchMock.mock.calls.filter(([, options]) => (options?.method ?? "GET") === method);

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Dashboard chat intelligence", () => {
  it("renders the demo without network requests and shows literal evidence without fake links", async () => {
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} demoReport={report()} />);
    expect(screen.getByRole("heading", { name: "Objeções por categoria" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dúvidas frequentes" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /analisar mensagens|atualizar análise/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver mensagens: Preço e orçamento" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Achei o valor alto para meu orçamento.")).toBeInTheDocument();
    expect(within(dialog).getByText("Esclarecer as condições reais da oferta.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Abrir conversa" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the exact scope without starting analysis and links evidence to the supported conversation route", async () => {
    fetchMock.mockImplementation(() => jsonResponse(report()));
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    await user.click(await screen.findByRole("button", { name: "Ver mensagens: Preço e orçamento" }));
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost");
    expect(url.pathname).toBe("/api/dashboard/chat-intelligence");
    expect(Object.fromEntries(url.searchParams)).toEqual(scope);
    expect(methodCalls("POST")).toHaveLength(0);
    const href = within(screen.getByRole("dialog")).getByRole("link", { name: "Abrir conversa" }).getAttribute("href")!;
    const conversationUrl = new URL(href, "http://localhost");
    expect(conversationUrl.pathname).toBe("/atendimento");
    expect(conversationUrl.searchParams.get("leadId")).toBe("lead 1");
  });

  it("processes every batch sequentially until no pending messages remain", async () => {
    fetchMock
      .mockImplementationOnce(() => jsonResponse(pending()))
      .mockImplementationOnce(() => jsonResponse({ processedMessages: 4, busy: false, report: report({ analyzedMessages: 4, pendingMessages: 6 }) }))
      .mockImplementationOnce(() => jsonResponse({ processedMessages: 6, busy: false, report: report() }));
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    await user.click(await screen.findByRole("button", { name: "Analisar mensagens" }));
    await waitFor(() => expect(methodCalls("POST")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Pausar análise" })).not.toBeInTheDocument());
    for (const [, options] of methodCalls("POST")) expect(JSON.parse(options!.body as string)).toEqual(scope);
    expect(screen.getByRole("button", { name: "Ver mensagens: Preço e orçamento" })).toBeInTheDocument();
  });

  it("pauses after saving the active batch and resumes only on a new explicit action", async () => {
    const batch = deferred<Response>();
    fetchMock
      .mockImplementationOnce(() => jsonResponse(pending()))
      .mockImplementationOnce(() => batch.promise)
      .mockImplementationOnce(() => jsonResponse({ processedMessages: 6, busy: false, report: report() }));
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    await user.click(await screen.findByRole("button", { name: "Analisar mensagens" }));
    await user.click(await screen.findByRole("button", { name: "Pausar análise" }));
    await act(async () => batch.resolve(await jsonResponse({ processedMessages: 4, busy: false, report: report({ analyzedMessages: 4, pendingMessages: 6 }) })));
    const resume = await screen.findByRole("button", { name: "Atualizar análise" });
    expect(methodCalls("POST")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ver mensagens: Preço e orçamento" })).toBeInTheDocument();
    await user.click(resume);
    await waitFor(() => expect(methodCalls("POST")).toHaveLength(2));
  });

  it("backs off when another analysis owns the lease and observes completion without another POST", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockImplementationOnce(() => jsonResponse(pending()))
      .mockImplementationOnce(() => jsonResponse({ processedMessages: 0, busy: true, report: pending({ isProcessing: true }) }))
      .mockImplementationOnce(() => jsonResponse(report()));
    render(<DashboardChatIntelligence {...scope} />);
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Analisar mensagens" })); });
    expect(methodCalls("POST")).toHaveLength(1);
    expect(methodCalls("GET")).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1499); });
    expect(methodCalls("GET")).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(methodCalls("GET")).toHaveLength(2);
    expect(methodCalls("POST")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Pausar análise" })).not.toBeInTheDocument();
  });

  it("bounds polling for a continuously busy lease instead of creating an endless request loop", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => jsonResponse(pending({ isProcessing: true })));
    render(<DashboardChatIntelligence {...scope} />);
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Analisar mensagens" })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(methodCalls("GET")).toHaveLength(7);
    expect(methodCalls("POST")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Pausar análise" })).not.toBeInTheDocument();
    expect(screen.getByText(/Outra análise continua em andamento/)).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(methodCalls("GET")).toHaveLength(7);
  });

  it("stops when a batch makes no progress and preserves results for an explicit retry", async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse(pending()))
      .mockImplementationOnce(() => jsonResponse({ processedMessages: 0, busy: false, report: pending() }));
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    await user.click(await screen.findByRole("button", { name: "Analisar mensagens" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A análise não avançou");
    expect(methodCalls("POST")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Analisar mensagens" })).toBeEnabled();
  });

  it("discards late responses and aborts the old request when the webinar or period changes", async () => {
    const old = deferred<Response>();
    fetchMock.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => jsonResponse(report({
      webinarId: "second-webinar", objections: [category("trust", "Confiança e credibilidade")]
    })));
    const { rerender } = render(<DashboardChatIntelligence {...scope} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const oldSignal = fetchMock.mock.calls[0][1]?.signal;
    rerender(<DashboardChatIntelligence {...scope} webinarId="second-webinar" from="2026-11-01T03:00:00.000Z" />);
    await screen.findByRole("button", { name: "Ver mensagens: Confiança e credibilidade" });
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => old.resolve(await jsonResponse(report())));
    expect(screen.queryByRole("button", { name: "Ver mensagens: Preço e orçamento" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver mensagens: Confiança e credibilidade" })).toBeInTheDocument();
  });

  it("does not launch another batch for an obsolete scope when its active POST finishes late", async () => {
    const oldBatch = deferred<Response>();
    fetchMock.mockImplementationOnce(() => jsonResponse(pending()))
      .mockImplementationOnce(() => oldBatch.promise)
      .mockImplementationOnce(() => jsonResponse(report({
        webinarId: "second-webinar", objections: [category("trust", "Confiança e credibilidade")]
      })));
    const user = userEvent.setup();
    const { rerender } = render(<DashboardChatIntelligence {...scope} />);
    await user.click(await screen.findByRole("button", { name: "Analisar mensagens" }));
    const postSignal = methodCalls("POST")[0][1]?.signal;
    rerender(<DashboardChatIntelligence {...scope} webinarId="second-webinar" />);
    await screen.findByRole("button", { name: "Ver mensagens: Confiança e credibilidade" });
    expect(postSignal?.aborted).toBe(true);
    await act(async () => oldBatch.resolve(await jsonResponse({ processedMessages: 4, busy: false, report: report({ analyzedMessages: 4, pendingMessages: 6 }) })));
    expect(methodCalls("POST")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Ver mensagens: Preço e orçamento" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver mensagens: Confiança e credibilidade" })).toBeInTheDocument();
  });

  it("clears an open evidence dialog when the scope changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DashboardChatIntelligence {...scope} demoReport={report()} />);
    await user.click(screen.getByRole("button", { name: "Ver mensagens: Preço e orçamento" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<DashboardChatIntelligence {...scope} from="2026-11-01T03:00:00.000Z" demoReport={report()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains the missing provider beside the coverage and rechecks it without starting analysis", async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse(pending({ providerReady: false })))
      .mockImplementationOnce(() => jsonResponse(pending()));
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    const button = await screen.findByRole("button", { name: "Analisar mensagens" });
    expect(button).toBeDisabled();
    const coverage = screen.getByRole("status");
    expect(within(coverage).getByText("IA não configurada")).toBeInTheDocument();
    const reason = within(coverage).getByText(/Configure a chave de IA no servidor/);
    expect(button).toHaveAttribute("aria-describedby", reason.id);
    expect(button).toHaveAccessibleDescription(reason.textContent!);
    expect(coverage).toHaveTextContent("0 de 10 mensagens analisadas");
    expect(screen.queryByText("Aguardando análise")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recarregar resultados" }));
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByText("IA não configurada")).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(methodCalls("GET")).toHaveLength(2);
    expect(methodCalls("POST")).toHaveLength(0);
  });

  it("shows refresh progress and confirmation while preserving saved counts and evidence", async () => {
    const refresh = deferred<Response>();
    fetchMock.mockImplementationOnce(() => jsonResponse(report({ analyzedMessages: 4, pendingMessages: 6 })))
      .mockImplementationOnce(() => refresh.promise);
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    const button = await screen.findByRole("button", { name: "Recarregar resultados" });
    expect(button).toHaveTextContent("Recarregar resultados");
    await user.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Recarregando…");
    expect(screen.getByRole("status")).toHaveTextContent("4 de 10 mensagens analisadas");
    expect(screen.getByRole("button", { name: "Ver mensagens: Preço e orçamento" })).toBeInTheDocument();
    await act(async () => refresh.resolve(await jsonResponse(report({ totalMessages: 11, analyzedMessages: 4, pendingMessages: 7 }))));
    expect(await screen.findByText("Resultados recarregados.")).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText(/de 11 mensagens analisadas/)).toHaveTextContent("4 de 11 mensagens analisadas");
    expect(methodCalls("GET")).toHaveLength(2);
    expect(methodCalls("POST")).toHaveLength(0);
  });

  it.each([
    [401, "unauthorized", "Sua sessão expirou"],
    [403, "invalid_origin", "Abra novamente a plataforma pelo endereço oficial"],
    [403, "forbidden", "Não foi possível acessar as mensagens deste webinar"],
    [409, "provider_missing", "A integração de IA não está configurada no servidor"],
    [429, "provider_rate_limited", "O serviço de IA atingiu o limite de uso"]
  ])("explains API error %s (%s) without retrying automatically", async (status, error, message) => {
    fetchMock.mockImplementationOnce(() => jsonResponse(report({ analyzedMessages: 4, pendingMessages: 6 })))
      .mockImplementationOnce(() => jsonResponse({ error }, status as number));
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    await user.click(await screen.findByRole("button", { name: "Atualizar análise" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Ver mensagens: Preço e orçamento" })).toBeInTheDocument();
    expect(methodCalls("POST")).toHaveLength(1);
  });

  it("blocks analysis if the provider becomes unavailable and retries by rechecking configuration", async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse(report({ analyzedMessages: 4, pendingMessages: 6 })))
      .mockImplementationOnce(() => jsonResponse({ error: "provider_missing" }, 409))
      .mockImplementationOnce(() => jsonResponse(report({ analyzedMessages: 4, pendingMessages: 6 })));
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    const analyze = await screen.findByRole("button", { name: "Atualizar análise" });
    await user.click(analyze);
    await screen.findByRole("alert");
    expect(analyze).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("IA não configurada");
    expect(screen.getByRole("status")).toHaveTextContent("4 de 10 mensagens analisadas");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(analyze).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(methodCalls("GET")).toHaveLength(2);
    expect(methodCalls("POST")).toHaveLength(1);
  });

  it("allows retrying a failed initial load without starting a paid analysis", async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse({ error: "Unavailable" }, 503))
      .mockImplementationOnce(() => jsonResponse(report()));
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    await user.click(await screen.findByRole("button", { name: /tentar novamente/i }));
    await screen.findByRole("button", { name: "Ver mensagens: Preço e orçamento" });
    expect(methodCalls("GET")).toHaveLength(2);
    expect(methodCalls("POST")).toHaveLength(0);
  });

  it("keeps partial results on an analysis failure and retries only when requested", async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse(report({ analyzedMessages: 4, pendingMessages: 6 })))
      .mockImplementationOnce(() => jsonResponse({ error: "Provider unavailable" }, 502))
      .mockImplementationOnce(() => jsonResponse({ processedMessages: 6, busy: false, report: report() }));
    const user = userEvent.setup();
    render(<DashboardChatIntelligence {...scope} />);
    await user.click(await screen.findByRole("button", { name: "Atualizar análise" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Ver mensagens: Preço e orçamento" })).toBeInTheDocument();
    expect(methodCalls("POST")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Atualizar análise" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));
    await waitFor(() => expect(methodCalls("POST")).toHaveLength(2));
    expect(methodCalls("GET")).toHaveLength(1);
  });

  it("does not fetch an absent webinar or manufacture classified rows for an empty period", async () => {
    const { rerender } = render(<DashboardChatIntelligence from={from} to={to} />);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockImplementation(() => jsonResponse(pending({ totalMessages: 0, pendingMessages: 0 })));
    rerender(<DashboardChatIntelligence {...scope} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Analisar mensagens" })).toBeDisabled());
    expect(screen.queryByRole("button", { name: /Ver mensagens:/ })).not.toBeInTheDocument();
  });

  it("paginates both rankings independently and preserves overlap percentages", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 6 }, (_, index) => category(`topic-${index}`, `Categoria ${index + 1}`, 3));
    render(<DashboardChatIntelligence {...scope} demoReport={report({ objections: rows, questions: rows.map((row) => ({ ...row, label: `Pergunta ${row.id}` })) })} />);
    expect(screen.getAllByRole("button", { name: /Ver mensagens: Categoria/ })).toHaveLength(5);
    expect(screen.getAllByRole("button", { name: /Ver mensagens: Pergunta/ })).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "Próxima página de objeções" }));
    expect(screen.getByRole("button", { name: "Ver mensagens: Categoria 6" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Ver mensagens: Pergunta/ })).toHaveLength(5);
    expect(screen.getAllByText("75%").length).toBeGreaterThan(1);
    await user.click(screen.getByRole("button", { name: "Próxima página de dúvidas" }));
    expect(screen.getByRole("button", { name: "Ver mensagens: Pergunta topic-5" })).toBeInTheDocument();
  });
});
