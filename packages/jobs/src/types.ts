export const QUEUE_NAME = "video";

export const JOB_TRANSCODE = "transcode-video";
export const JOB_DELETE_ASSETS = "delete-video-assets";

export interface TranscodePayload {
  videoId: string;
}

export interface DeleteAssetsPayload {
  videoId: string;
  ownerId: string;
}

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
