import { tasks } from "@trigger.dev/sdk";
import {
  JOB_TRANSCODE,
  JOB_DELETE_ASSETS,
  type TranscodePayload,
  type DeleteAssetsPayload
} from "./types";

// Video jobs run on Trigger.dev. Webhooks use the Redis queue in ./webhook-queue.
export async function enqueueTranscode(payload: TranscodePayload) {
  return tasks.trigger(JOB_TRANSCODE, payload);
}

export async function enqueueDeleteAssets(payload: DeleteAssetsPayload) {
  return tasks.trigger(JOB_DELETE_ASSETS, payload);
}
