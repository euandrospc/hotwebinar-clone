import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getTriggerConfig } from "./env";

export interface TempDir {
  path: string;
  cleanup: () => Promise<void>;
}

export async function makeJobTempDir(jobId: string): Promise<TempDir> {
  const root = getTriggerConfig().tmpRoot ?? os.tmpdir();
  const dir = path.join(root, `transcode-${jobId}-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  return {
    path: dir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    }
  };
}
