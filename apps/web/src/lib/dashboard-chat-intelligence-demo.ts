import {
  OBJECTION_CATEGORIES,
  QUESTION_CATEGORIES,
  type ChatInsightCategory,
  type ChatIntelligenceReport,
  type ObjectionCode,
  type QuestionCode
} from "@/lib/dashboard-chat-intelligence";

interface DemoStatement {
  text: string;
  weight: number;
  objections: ObjectionCode[];
  questions: QuestionCode[];
}

/** Synthetic examples only; never written to the database or sent to the provider. */
const statements: DemoStatement[] = [
  { text: "Gostei da proposta, mas esse valor não cabe no meu orçamento agora.", weight: 8, objections: ["price"], questions: [] },
  { text: "Achei caro para o meu momento. Consigo parcelar no cartão?", weight: 5, objections: ["price", "payment"], questions: ["payment"] },
  { text: "Trabalho o dia inteiro e não sei se vou conseguir acompanhar as aulas.", weight: 6, objections: ["time"], questions: [] },
  { text: "Não tenho tempo no horário ao vivo. As aulas ficam gravadas?", weight: 4, objections: ["time"], questions: ["recordings"] },
  { text: "Tenho receio de não conseguir aplicar, nunca construí um sistema antes.", weight: 5, objections: ["difficulty"], questions: [] },
  { text: "Já comprei outros cursos e não tive resultado. Tenho medo de acontecer de novo.", weight: 4, objections: ["trust", "results"], questions: [] },
  { text: "Sou totalmente iniciante e acho que isso talvez não seja para mim.", weight: 3, objections: ["fit"], questions: [] },
  { text: "Vou deixar para outro momento porque tenho outras prioridades agora.", weight: 2, objections: ["priority"], questions: [] },
  { text: "Qual é o valor total da mentoria?", weight: 7, objections: [], questions: ["price"] },
  { text: "Dá para pagar por Pix ou parcelar no cartão?", weight: 8, objections: [], questions: ["payment"] },
  { text: "Se eu perder um encontro, consigo assistir à gravação depois?", weight: 7, objections: [], questions: ["recordings"] },
  { text: "Em quais dias e horários acontecem os encontros?", weight: 6, objections: [], questions: ["schedule"] },
  { text: "Como funciona o suporte quando eu travar no meu projeto?", weight: 5, objections: [], questions: ["support"] },
  { text: "Por quanto tempo posso acessar os materiais e as gravações?", weight: 4, objections: [], questions: ["access", "recordings"] },
  { text: "Preciso saber programar antes de começar?", weight: 4, objections: [], questions: ["prerequisites"] },
  { text: "Quais ferramentas vou precisar instalar? Preciso de uma assinatura paga?", weight: 3, objections: [], questions: ["tools"] },
  { text: "O que está incluído nos materiais da mentoria?", weight: 3, objections: [], questions: ["content"] },
  { text: "Onde encontro as condições da garantia e do cancelamento?", weight: 2, objections: [], questions: ["guarantee"] },
  { text: "Tem certificado de participação?", weight: 2, objections: [], questions: ["certificate"] },
  { text: "Como faço para concluir minha inscrição?", weight: 2, objections: [], questions: ["purchase"] },
  { text: "Boa noite! Estou acompanhando e gostando muito da apresentação.", weight: 44, objections: [], questions: [] }
];

function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((value, weight) => value + weight, 0);
  const exact = weights.map((weight) => total * weight / sum);
  const counts = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, remainder: value - counts[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remainder = total - counts.reduce((value, count) => value + count, 0);
  for (let index = 0; index < remainder; index++) counts[order[index].index]++;
  return counts;
}

export function createChatIntelligenceDemo(input: {
  webinarId: string;
  totalMessages: number;
  uniqueConversations: number;
  from: Date;
  to: Date;
}): ChatIntelligenceReport {
  const start = input.from.getTime();
  const end = input.to.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || !Number.isSafeInteger(input.totalMessages) || input.totalMessages < 0) {
    throw new RangeError("Invalid chat intelligence demo input");
  }
  const counts = allocate(input.totalMessages, statements.map((statement) => statement.weight));
  const kindCount = (kind: "objections" | "questions") => statements.reduce((sum, statement, index) => sum + (statement[kind].length ? counts[index] : 0), 0);
  const objectionMessages = kindCount("objections");
  const questionMessages = kindCount("questions");
  const categories = (kind: "objections" | "questions"): ChatInsightCategory[] => {
    const catalog = kind === "objections" ? OBJECTION_CATEGORIES : QUESTION_CATEGORIES;
    const base = kind === "objections" ? objectionMessages : questionMessages;
    return catalog.map((category) => {
      const matching = statements.map((statement, index) => ({ statement, index, count: counts[index] }))
        .filter(({ statement, count }) => count > 0 && (statement[kind] as readonly string[]).includes(category.id));
      const messageCount = matching.reduce((sum, row) => sum + row.count, 0);
      return {
        ...category,
        messageCount,
        conversationCount: Math.min(messageCount, input.uniqueConversations, Math.max(matching.length, Math.round(messageCount * 0.74))),
        percentage: base ? Math.round(messageCount / base * 10_000) / 100 : 0,
        examples: matching.slice(0, 5).map(({ statement, index }) => ({
          id: `demo-insight-message-${index}`,
          leadId: `demo-insight-person-${index}`,
          text: statement.text,
          createdAt: new Date(start + Math.floor((end - start) * (index + 1) / (statements.length + 1))).toISOString()
        }))
      };
    }).filter((category) => category.messageCount > 0).sort((a, b) => b.messageCount - a.messageCount || a.label.localeCompare(b.label, "pt-BR"));
  };
  return {
    webinarId: input.webinarId,
    providerReady: true,
    isProcessing: false,
    totalMessages: input.totalMessages,
    analyzedMessages: input.totalMessages,
    pendingMessages: 0,
    objectionMessages,
    questionMessages,
    neutralMessages: statements.reduce((sum, statement, index) => sum + (!statement.objections.length && !statement.questions.length ? counts[index] : 0), 0),
    lastAnalyzedAt: input.totalMessages ? input.to.toISOString() : null,
    objections: categories("objections"),
    questions: categories("questions")
  };
}
