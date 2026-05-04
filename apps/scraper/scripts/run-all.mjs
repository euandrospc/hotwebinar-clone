#!/usr/bin/env node
import { spawn } from "node:child_process";

const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const stages = ["scrape:replay", "scrape:crawl", "scrape:analyze"];
const env = { ...process.env, RUN_ID: runId };

console.log("RUN_ID:", runId);

for (const stage of stages) {
  console.log(`\n=== ${stage} ===`);
  const code = await new Promise((resolve) => {
    const child = spawn("pnpm", [stage], { stdio: "inherit", shell: true, env });
    child.on("exit", resolve);
  });
  if (code !== 0) {
    console.error(`Stage ${stage} failed with exit ${code}`);
    process.exit(code);
  }
}

console.log("\nAll stages complete. Run dir: capture/" + runId);
