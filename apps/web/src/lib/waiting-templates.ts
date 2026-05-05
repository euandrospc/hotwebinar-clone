export type WaitingTemplateId = "DEFAULT" | "WITH_THUMB" | "IMMERSIVE" | "MINIMAL" | "FEATURES";

export interface WaitingTemplate {
  id: WaitingTemplateId;
  label: string;
  description: string;
}

export const WAITING_TEMPLATES: ReadonlyArray<WaitingTemplate> = [
  { id: "DEFAULT", label: "Padrão", description: "Logo + título + countdown centralizados." },
  { id: "WITH_THUMB", label: "Com thumbnail", description: "Padrão + thumbnail do vídeo." },
  { id: "IMMERSIVE", label: "Imersivo", description: "Vídeo de fundo silenciado + countdown sobreposto." },
  { id: "MINIMAL", label: "Minimalista", description: "Apenas relógio gigante. Sem título/subtítulo." },
  { id: "FEATURES", label: "Com benefícios", description: "Lista de benefícios + countdown ao lado." }
];
