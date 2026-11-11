/** Stable codes allow classifications to be reused across dashboard date ranges. */
export const CHAT_INTELLIGENCE_VERSION = "2026-11-11-v2";

export const OBJECTION_CATEGORIES = [
  { id: "price", label: "Preço e orçamento", guidance: "Explicitar o valor entregue e esclarecer o investimento e as condições reais da oferta." },
  { id: "time", label: "Falta de tempo", guidance: "Mostrar a dedicação necessária e como a proposta pode se encaixar na rotina." },
  { id: "trust", label: "Confiança e credibilidade", guidance: "Apresentar evidências verificáveis, demonstrações e limites da promessa." },
  { id: "fit", label: "Adequação ao perfil", guidance: "Deixar claro para quem a oferta serve, os pré-requisitos e para quem não é indicada." },
  { id: "difficulty", label: "Dificuldade para aplicar", guidance: "Demonstrar o primeiro passo e esclarecer o apoio disponível durante a execução." },
  { id: "priority", label: "Prioridade e momento", guidance: "Entender o motivo do adiamento e conectar a proposta ao objetivo atual da pessoa." },
  { id: "payment", label: "Condições de pagamento", guidance: "Esclarecer as formas de pagamento disponíveis e os obstáculos para concluir a compra." },
  { id: "results", label: "Dúvida sobre resultados", guidance: "Demonstrar aplicações concretas, esforço necessário e resultados que podem ser comprovados." },
  { id: "other", label: "Outras objeções", guidance: "Revisar as mensagens para identificar barreiras que merecem uma abordagem específica." }
] as const;

export const QUESTION_CATEGORIES = [
  { id: "price", label: "Qual é o valor do investimento?", guidance: "Tornar o preço e o que está incluído fáceis de encontrar." },
  { id: "payment", label: "Quais são as formas de pagamento?", guidance: "Explicar parcelamento e métodos de pagamento realmente disponíveis." },
  { id: "recordings", label: "As aulas ficam gravadas?", guidance: "Esclarecer a disponibilidade das gravações e como acessá-las." },
  { id: "access", label: "Como e por quanto tempo tenho acesso?", guidance: "Explicar a liberação, a plataforma e o prazo de acesso contratado." },
  { id: "schedule", label: "Quando acontecem as aulas e quanto duram?", guidance: "Apresentar calendário, horários, duração e carga de dedicação." },
  { id: "content", label: "O que vou aprender e receber?", guidance: "Detalhar conteúdo, entregáveis e materiais incluídos na oferta." },
  { id: "prerequisites", label: "Preciso ter conhecimento prévio?", guidance: "Informar os pré-requisitos e o nível de experiência esperado." },
  { id: "tools", label: "Quais ferramentas ou equipamentos preciso?", guidance: "Listar requisitos técnicos e eventuais custos adicionais confirmados." },
  { id: "support", label: "Como funciona o suporte?", guidance: "Explicar canais de suporte, acompanhamento e disponibilidade da equipe." },
  { id: "certificate", label: "Há certificado?", guidance: "Informar se existe certificado e quais são os critérios reais de emissão." },
  { id: "guarantee", label: "Como funcionam garantia e cancelamento?", guidance: "Facilitar o acesso às condições oficiais da oferta, sem prometer exceções." },
  { id: "purchase", label: "Como faço a inscrição ou concluo a compra?", guidance: "Tornar o caminho de inscrição claro e verificar dificuldades no checkout." },
  { id: "other", label: "Outras dúvidas", guidance: "Revisar as perguntas para identificar novos assuntos a esclarecer na apresentação." }
] as const;

export type ObjectionCode = typeof OBJECTION_CATEGORIES[number]["id"];
export type QuestionCode = typeof QUESTION_CATEGORIES[number]["id"];
export interface ChatInsightExample {
  id: string;
  leadId: string;
  text: string;
  createdAt: string;
}
export interface ChatInsightCategory {
  id: string;
  label: string;
  guidance: string;
  messageCount: number;
  conversationCount: number;
  /** Share of distinct analyzed messages of this kind; categories can overlap. */
  percentage: number;
  /** Exact excerpts selected from stored messages, never authored by the classifier. */
  examples: ChatInsightExample[];
}
export interface ChatIntelligenceReport {
  webinarId: string;
  providerReady: boolean;
  isProcessing: boolean;
  totalMessages: number;
  analyzedMessages: number;
  pendingMessages: number;
  objectionMessages: number;
  questionMessages: number;
  neutralMessages: number;
  lastAnalyzedAt: string | null;
  objections: ChatInsightCategory[];
  questions: ChatInsightCategory[];
}
export interface ChatIntelligenceBatchResult {
  processedMessages: number;
  busy: boolean;
  report: ChatIntelligenceReport;
}
