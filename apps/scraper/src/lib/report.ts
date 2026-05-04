import type { Schema } from "./schema-infer.js";

export type EndpointAnalysis = {
  method: string;
  pathPattern: string;
  samples: number;
  statusCodes: number[];
  requestBodySchema: Schema;
  responseSchema: Schema;
};

export type PageAnalysis = {
  route: string;
  url: string;
  status: number;
  requestCount: number;
  screenshot: string;
};

export type Analysis = {
  runId: string;
  endpoints: EndpointAnalysis[];
  entities: Record<string, Schema>;
  pages: PageAnalysis[];
};

function renderSchema(s: Schema, indent = 0): string {
  const pad = "  ".repeat(indent);
  switch (s.kind) {
    case "primitive": {
      const flags: string[] = [];
      if (s.optional) flags.push("?");
      if (s.nullable) flags.push("| null");
      return `${s.type}${flags.join(" ")}`;
    }
    case "array":
      return `Array<${renderSchema(s.element, indent)}>`;
    case "object": {
      const lines = ["{"];
      for (const [k, v] of Object.entries(s.fields)) {
        lines.push(`${pad}  ${k}: ${renderSchema(v, indent + 1)}`);
      }
      lines.push(`${pad}}`);
      return lines.join("\n");
    }
    case "unknown":
      return "unknown";
  }
}

export function buildReport(a: Analysis): string {
  const out: string[] = [];
  out.push(`# Capture Report — ${a.runId}`, "");

  out.push("## Endpoints", "");
  out.push("| Method | Path | Samples | Status codes |");
  out.push("|--------|------|---------|--------------|");
  for (const e of a.endpoints) {
    out.push(`| ${e.method} | \`${e.pathPattern}\` | ${e.samples} | ${e.statusCodes.join(", ")} |`);
  }
  out.push("");

  out.push("## Entities", "");
  for (const [name, schema] of Object.entries(a.entities)) {
    out.push(`### \`${name}\``, "");
    out.push("```");
    out.push(renderSchema(schema));
    out.push("```", "");
  }

  out.push("## Pages", "");
  out.push("| Route | Status | Requests | Screenshot |");
  out.push("|-------|--------|----------|------------|");
  for (const p of a.pages) {
    out.push(`| \`${p.route}\` | ${p.status} | ${p.requestCount} | \`${p.screenshot}\` |`);
  }
  out.push("");

  return out.join("\n");
}
