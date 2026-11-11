import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardSupportOverview, type DashboardSupportData } from "@/components/dashboard/dashboard-support-overview";

afterEach(cleanup);

const agents: DashboardSupportData["agents"] = [
  { id: "ana", name: "Ana Oliveira", kind: "human", image: null, conversations: 5, replies: 50, averageFirstReplySeconds: 12, firstReplySamples: 2 },
  { id: "bruno", name: "Bruno Costa", kind: "human", image: null, conversations: 15, replies: 40, averageFirstReplySeconds: 0, firstReplySamples: 3 },
  { id: "carla", name: "Carla Santos", kind: "human", image: null, conversations: 8, replies: 30, averageFirstReplySeconds: 84, firstReplySamples: 2 },
  { id: "diego", name: "Diego Almeida", kind: "human", image: null, conversations: 20, replies: 20, averageFirstReplySeconds: 180, firstReplySamples: 3 },
  { id: "elisa", name: "Elisa Lima", kind: "human", image: null, conversations: 2, replies: 10, averageFirstReplySeconds: 500, firstReplySamples: 1 },
  { id: "unknown", name: "Equipe sem identificação", kind: "unattributed", image: null, conversations: 1, replies: 5, averageFirstReplySeconds: null, firstReplySamples: 0 },
  { id: "ai", name: "Assistente Bravy", kind: "ai", image: null, conversations: 18, replies: 45, averageFirstReplySeconds: 4, firstReplySamples: 4 }
];

const support: DashboardSupportData = {
  human: { conversations: 40, replies: 155, averageFirstReplySeconds: 112 },
  ai: { conversations: 18, replies: 45, averageFirstReplySeconds: 4 },
  uniqueConversations: 50, incomingMessages: 100, repliedConversations: 48,
  awaitingReplyConversations: 5, averageFirstReplySeconds: 83, firstReplySamples: 15,
  agents,
  activity: [
    { date: "2026-11-10", label: "10/11", incoming: 40, human: 70, ai: 20 },
    { date: "2026-11-11", label: "11/11", incoming: 60, human: 85, ai: 25 }
  ]
};

const table = () => screen.getByRole("table", { name: /Respostas atribuídas ao autor/ });
const visibleNames = () => within(table()).getAllByRole("row").slice(1).map((row) =>
  within(row).getByRole("button", { name: /primeira resposta/ }).getAttribute("aria-label")!.split(":")[0]
);
const agentRow = (name: string) => within(table()).getByRole("row", { name: new RegExp(name) });
const kindButton = (name: string) => within(screen.getByRole("group", { name: "Tipo de atendente" })).getByRole("button", { name });
const nextPage = () => screen.getByRole("button", { name: "Próxima página de atendentes" });

describe("Dashboard support overview", () => {
  it("shows activity, overlapping channels and the supported conversations route", () => {
    render(<DashboardSupportOverview support={support} webinarId="selected" />);
    expect(screen.getByText("48 com resposta da equipe ou IA")).toBeInTheDocument();
    expect(screen.getByText("100 mensagens recebidas")).toBeInTheDocument();
    expect(screen.getByText("15 primeiras respostas observadas")).toBeInTheDocument();
    expect(screen.getByText("Sem retorno no recorte")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Equipe humana" })).getByText("155 respostas")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Agentes de IA" })).getByText("45 respostas")).toBeInTheDocument();
    expect(screen.getByText("Uma conversa pode envolver mais de um atendente.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver conversas" })).toHaveAttribute("href", "/atendimento");
    expect(visibleNames()).toEqual(["Ana Oliveira", "Assistente Bravy", "Bruno Costa", "Carla Santos", "Diego Almeida"]);
  });

  it("filters humans including unattributed replies, and isolates AI", async () => {
    const user = userEvent.setup();
    render(<DashboardSupportOverview support={support} />);
    await user.click(kindButton("Equipe"));
    expect(kindButton("Equipe")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("6 atendentes com respostas")).toBeInTheDocument();
    expect(visibleNames()).not.toContain("Assistente Bravy");
    await user.click(nextPage());
    expect(visibleNames()).toEqual(["Equipe sem identificação"]);
    expect(within(agentRow("Equipe sem identificação")).getByText("Autoria não registrada")).toBeInTheDocument();
    await user.click(kindButton("IA"));
    expect(visibleNames()).toEqual(["Assistente Bravy"]);
    expect(screen.queryByRole("navigation", { name: "Páginas de atendentes" })).not.toBeInTheDocument();
    await user.click(kindButton("Todos"));
    expect(visibleNames()[0]).toBe("Ana Oliveira");
  });

  it("searches names without case sensitivity, trims input and restores page one", async () => {
    const user = userEvent.setup();
    render(<DashboardSupportOverview support={support} />);
    await user.click(nextPage());
    await user.type(screen.getByRole("textbox", { name: "Buscar atendente" }), " BRUNO ");
    expect(visibleNames()).toEqual(["Bruno Costa"]);
    await user.clear(screen.getByRole("textbox", { name: "Buscar atendente" }));
    expect(visibleNames()[0]).toBe("Ana Oliveira");
    expect(screen.getByRole("button", { name: "Página anterior de atendentes" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Buscar atendente" }), "Sem correspondência");
    expect(screen.getByText("Nenhum atendente encontrado com esses filtros.")).toBeInTheDocument();
    expect(screen.queryByText("Os atendentes aparecerão aqui assim que enviarem respostas.")).not.toBeInTheDocument();
  });

  it("sorts conversations and replies in both directions with accessible sort state", async () => {
    const user = userEvent.setup();
    render(<DashboardSupportOverview support={support} />);
    await user.click(screen.getByRole("button", { name: "Ordenar por conversas" }));
    expect(visibleNames()).toEqual(["Diego Almeida", "Assistente Bravy", "Bruno Costa", "Carla Santos", "Ana Oliveira"]);
    expect(within(table()).getByRole("columnheader", { name: /Conversas/i })).toHaveAttribute("aria-sort", "descending");
    await user.click(screen.getByRole("button", { name: "Ordenar por conversas" }));
    expect(visibleNames()).toEqual(["Equipe sem identificação", "Elisa Lima", "Ana Oliveira", "Carla Santos", "Bruno Costa"]);
    expect(within(table()).getByRole("columnheader", { name: /Conversas/i })).toHaveAttribute("aria-sort", "ascending");
    await user.click(screen.getByRole("button", { name: "Ordenar por respostas" }));
    expect(visibleNames()[0]).toBe("Ana Oliveira");
    await user.click(screen.getByRole("button", { name: "Ordenar por respostas" }));
    expect(visibleNames()).toEqual(["Equipe sem identificação", "Elisa Lima", "Diego Almeida", "Carla Santos", "Bruno Costa"]);
  });

  it("sorts response times numerically, preserves zero and always puts missing samples last", async () => {
    const user = userEvent.setup();
    render(<DashboardSupportOverview support={support} />);
    await user.click(screen.getByRole("button", { name: "Ordenar por 1ª resposta" }));
    expect(visibleNames()).toEqual(["Bruno Costa", "Assistente Bravy", "Ana Oliveira", "Carla Santos", "Diego Almeida"]);
    expect(within(agentRow("Bruno Costa")).getByText("0 s")).toBeInTheDocument();
    await user.click(nextPage());
    expect(visibleNames()).toEqual(["Elisa Lima", "Equipe sem identificação"]);
    await user.click(screen.getByRole("button", { name: "Ordenar por 1ª resposta" }));
    expect(visibleNames()).toEqual(["Elisa Lima", "Diego Almeida", "Carla Santos", "Ana Oliveira", "Assistente Bravy"]);
    await user.click(nextPage());
    expect(visibleNames()).toEqual(["Bruno Costa", "Equipe sem identificação"]);
    expect(within(agentRow("Equipe sem identificação")).getByText("—")).toBeInTheDocument();
  });

  it("paginates five at a time and clamps the page when refreshed results shrink", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DashboardSupportOverview support={support} />);
    expect(visibleNames()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Página anterior de atendentes" })).toBeDisabled();
    await user.click(nextPage());
    expect(visibleNames()).toEqual(["Elisa Lima", "Equipe sem identificação"]);
    expect(nextPage()).toBeDisabled();
    expect(screen.getByText("2 de 2")).toBeInTheDocument();
    rerender(<DashboardSupportOverview support={{ ...support, agents: agents.slice(0, 2) }} />);
    expect(visibleNames()).toEqual(["Ana Oliveira", "Bruno Costa"]);
    expect(screen.queryByRole("navigation", { name: "Páginas de atendentes" })).not.toBeInTheDocument();
  });

  it("keeps participation based on all replies after filtering and searching", async () => {
    const user = userEvent.setup();
    render(<DashboardSupportOverview support={support} />);
    expect(within(agentRow("Ana Oliveira")).getByText("25%")).toBeInTheDocument();
    await user.click(kindButton("Equipe"));
    expect(within(agentRow("Ana Oliveira")).getByText("25%")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Buscar atendente" }), "Ana");
    expect(visibleNames()).toEqual(["Ana Oliveira"]);
    expect(within(agentRow("Ana Oliveira")).getByText("25%")).toBeInTheDocument();
    expect(within(agentRow("Ana Oliveira")).queryByText("100%")).not.toBeInTheDocument();
  });

  it("switches the chart to incoming messages while retaining the accessible daily data", async () => {
    const user = userEvent.setup();
    const { container } = render(<DashboardSupportOverview support={support} />);
    const controls = within(screen.getByRole("group", { name: "Mensagens no gráfico" }));
    expect(container.querySelector('[tremor-id="tremor-raw"]')).toHaveAttribute("aria-label", expect.stringContaining("respostas da equipe e da IA"));
    await user.click(controls.getByRole("button", { name: "Recebidas" }));
    expect(controls.getByRole("button", { name: "Recebidas" })).toHaveAttribute("aria-pressed", "true");
    expect(controls.getByRole("button", { name: "Respostas" })).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector('[tremor-id="tremor-raw"]')).toHaveAttribute("aria-label", expect.stringContaining("mensagens recebidas"));
    expect(screen.getByText("Mensagens enviadas pelo público por dia")).toBeInTheDocument();
    const dailyTable = within(screen.getByRole("table", { name: "Mensagens por dia, no horário de Brasília" }));
    expect(dailyTable.getAllByRole("row")).toHaveLength(3);
    expect(dailyTable.getByRole("row", { name: "2026-11-10 40 70 20" })).toBeInTheDocument();
  });

  it("explains first-response samples without turning unavailable data into zero", async () => {
    const user = userEvent.setup();
    render(<DashboardSupportOverview support={support} />);
    await user.hover(screen.getByRole("button", { name: "Ana Oliveira: primeira resposta 12 s, 2 amostras" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("2 primeiras respostas atribuídas a este atendente no período.");
    await user.unhover(screen.getByRole("button", { name: "Ana Oliveira: primeira resposta 12 s, 2 amostras" }));
    await user.click(nextPage());
    await user.hover(screen.getByRole("button", { name: "Equipe sem identificação: primeira resposta —, 0 amostras" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Este atendente não deu a primeira resposta em nenhuma amostra do período.");
  });

  it("identifies the unanswered figure as a historical cutoff instead of the current queue", async () => {
    const user = userEvent.setup();
    render(<DashboardSupportOverview support={support} />);
    await user.hover(screen.getByRole("button", { name: "Como as conversas sem retorno são contadas" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("não a fila atual");
    expect(screen.getByRole("tooltip")).toHaveTextContent("respostas posteriores e encerramentos não são considerados");
  });

  it("renders an honest empty state without drawing a chart or inventing averages", () => {
    const empty: DashboardSupportData = {
      human: { conversations: 0, replies: 0, averageFirstReplySeconds: null },
      ai: { conversations: 0, replies: 0, averageFirstReplySeconds: null },
      uniqueConversations: 0, incomingMessages: 0, repliedConversations: 0,
      awaitingReplyConversations: 0, averageFirstReplySeconds: null, firstReplySamples: 0,
      agents: [], activity: [{ date: "2026-11-11", label: "11/11", incoming: 0, human: 0, ai: 0 }]
    };
    const { container } = render(<DashboardSupportOverview support={empty} />);
    expect(screen.getByText("Sem mensagens neste período")).toBeInTheDocument();
    expect(screen.getByText("Sem amostras neste período")).toBeInTheDocument();
    expect(screen.getByText("Os atendentes aparecerão aqui assim que enviarem respostas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /primeira resposta .* amostras/ })).not.toBeInTheDocument();
    expect(container.querySelector('[tremor-id="tremor-raw"]')).toBeNull();
    expect(screen.queryByText("0 s")).not.toBeInTheDocument();
  });

  it("does not introduce demo badges or send simulated attendants to a real inbox", () => {
    render(<DashboardSupportOverview support={support} demo />);
    expect(screen.queryByText(/Dados de demonstração|Atendimentos simulados|Ver dados reais/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver conversas" })).not.toBeInTheDocument();
    expect(visibleNames()).toHaveLength(5);
  });
});
