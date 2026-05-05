export const QUEUE_NAME = "video";
export const QUEUE_WEBHOOK = "webhook";

export const JOB_TRANSCODE = "transcode-video";
export const JOB_DELETE_ASSETS = "delete-video-assets";
export const JOB_DISPATCH_WEBHOOK = "dispatch-webhook";

export interface TranscodePayload {
  videoId: string;
}

export interface DeleteAssetsPayload {
  videoId: string;
  ownerId: string;
}

export interface DispatchWebhookPayload {
  deliveryId: string;
}

export type WebhookEvent =
  | "lead_novo"
  | "lead_acessou"
  | "lead_viu_oferta"
  | "lead_clicou_oferta"
  | "lead_viu_pitch"
  | "lead_permaneceu"
  | "lead_saiu"
  | "lead_entrou_sorteio";

export type JobStage =
  | "downloading"
  | "probing"
  | "transcoding"
  | "uploading"
  | "thumbnail";

export interface JobProgress {
  pct: number;
  stage: JobStage;
}
