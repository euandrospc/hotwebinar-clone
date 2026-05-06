import { tasks } from "@trigger.dev/sdk";
import {
  JOB_TRANSCODE,
  JOB_DELETE_ASSETS,
  JOB_DISPATCH_WEBHOOK,
  type TranscodePayload,
  type DeleteAssetsPayload,
  type DispatchWebhookPayload
} from "./types";

export async function enqueueTranscode(payload: TranscodePayload) {
  return tasks.trigger(JOB_TRANSCODE, payload);
}

export async function enqueueDeleteAssets(payload: DeleteAssetsPayload) {
  return tasks.trigger(JOB_DELETE_ASSETS, payload);
}

export async function enqueueDispatchWebhook(payload: DispatchWebhookPayload) {
  return tasks.trigger(JOB_DISPATCH_WEBHOOK, payload);
}
