import type { Schema } from "./schema-infer.js";

export type EndpointAnalysis = {
  method: string;
  pathPattern: string;
  samples: number;
  truncatedSamples?: number;
  statusCodes: number[];
  // schemas surfaced via the Entities section, not per-endpoint
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

function renderFlags(s: { optional?: boolean; nullable?: boolean }): string {
  const parts: string[] = [];
  if (s.optional) parts.push("?");
  if (s.nullable) parts.push("| null");
  return parts.join(" ");
}

function renderSchema(s: Schema, indent = 0): string {
  const pad = "  ".repeat(indent);
  switch (s.kind) {
    case "primitive": {
      const flags = renderFlags(s);
      return flags ? `${s.type} ${flags}` : s.type;
    }
    case "array": {
      const flags = renderFlags(s);
      return `Array<${renderSchema(s.element, indent)}>${flags ? " " + flags : ""}`;
    }
    case "object": {
      const lines = ["{"];
      for (const [k, v] of Object.entries(s.fields)) {
        lines.push(`${pad}  ${k}: ${renderSchema(v, indent + 1)}`);
      }
      const flags = renderFlags(s);
      lines.push(`${pad}}${flags ? " " + flags : ""}`);
      return lines.join("\n");
    }
    case "unknown":
      return "unknown";
  }
}

const cell = (v: string) => v.replace(/\|/g, "\\|");

export function buildReport(a: Analysis): string {
  const out: string[] = [];
  out.push(`# Capture Report — ${a.runId}`, "");

  out.push("## Endpoints", "");
  if (a.endpoints.length === 0) {
    out.push("_No endpoints captured._", "");
  } else {
    out.push("| Method | Path | Samples | Status codes |");
    out.push("|--------|------|---------|--------------|");
    for (const e of a.endpoints) {
      const codes = [...e.statusCodes].sort((a, b) => a - b).join(", ");
      const sampleCol = e.truncatedSamples ? `${e.samples} (+${e.truncatedSamples} truncated)` : `${e.samples}`;
      out.push(`| ${e.method} | \`${cell(e.pathPattern)}\` | ${sampleCol} | ${codes} |`);
    }
    out.push("");
  }

  out.push("## Entities", "");
  if (Object.keys(a.entities).length === 0) {
    out.push("_No entities captured._", "");
  } else {
    for (const [name, schema] of Object.entries(a.entities)) {
      out.push(`### \`${name}\``, "");
      out.push("```");
      out.push(renderSchema(schema));
      out.push("```", "");
    }
  }

  out.push("## Pages", "");
  if (a.pages.length === 0) {
    out.push("_No pages captured._", "");
  } else {
    out.push("| Route | Status | Requests | Screenshot |");
    out.push("|-------|--------|----------|------------|");
    for (const p of a.pages) {
      out.push(`| \`${cell(p.route)}\` | ${p.status} | ${p.requestCount} | \`${cell(p.screenshot)}\` |`);
    }
    out.push("");
  }

  return out.join("\n");
}
