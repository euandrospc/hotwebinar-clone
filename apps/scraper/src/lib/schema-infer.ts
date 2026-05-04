export type Primitive = "string" | "number" | "boolean";

export type PrimitiveSchema = {
  kind: "primitive";
  type: Primitive;
  optional: boolean;
  nullable: boolean;
};

export type ArraySchema = {
  kind: "array";
  element: Schema;
  optional: boolean;
  nullable: boolean;
};

export type ObjectSchema = {
  kind: "object";
  fields: Record<string, Schema>;
};

export type UnknownSchema = { kind: "unknown" };

export type Schema = PrimitiveSchema | ArraySchema | ObjectSchema | UnknownSchema;

function inferOne(value: unknown): Schema {
  if (value === null || value === undefined) return { kind: "unknown" };
  if (typeof value === "string") {
    return { kind: "primitive", type: "string", optional: false, nullable: false };
  }
  if (typeof value === "number") {
    return { kind: "primitive", type: "number", optional: false, nullable: false };
  }
  if (typeof value === "boolean") {
    return { kind: "primitive", type: "boolean", optional: false, nullable: false };
  }
  if (Array.isArray(value)) {
    const elements = value.filter((v) => v !== null && v !== undefined);
    let element: Schema = { kind: "unknown" };
    for (const el of elements) {
      element = mergeSchemas(element, inferOne(el));
    }
    return { kind: "array", element, optional: false, nullable: false };
  }
  if (typeof value === "object") {
    const fields: Record<string, Schema> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = inferOne(v);
    }
    return { kind: "object", fields };
  }
  return { kind: "unknown" };
}

export function mergeSchemas(a: Schema, b: Schema): Schema {
  if (a.kind === "unknown") return b;
  if (b.kind === "unknown") return a;
  if (a.kind === "primitive" && b.kind === "primitive") {
    if (a.type !== b.type) return { kind: "unknown" };
    return {
      kind: "primitive",
      type: a.type,
      optional: a.optional || b.optional,
      nullable: a.nullable || b.nullable,
    };
  }
  if (a.kind === "array" && b.kind === "array") {
    return {
      kind: "array",
      element: mergeSchemas(a.element, b.element),
      optional: a.optional || b.optional,
      nullable: a.nullable || b.nullable,
    };
  }
  if (a.kind === "object" && b.kind === "object") {
    const allKeys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)]);
    const fields: Record<string, Schema> = {};
    for (const key of allKeys) {
      const inA = key in a.fields;
      const inB = key in b.fields;
      if (inA && inB) {
        fields[key] = mergeSchemas(a.fields[key]!, b.fields[key]!);
      } else if (inA) {
        fields[key] = setOptional(a.fields[key]!, true);
      } else {
        fields[key] = setOptional(b.fields[key]!, true);
      }
    }
    return { kind: "object", fields };
  }
  return { kind: "unknown" };
}

function setOptional(schema: Schema, optional: boolean): Schema {
  if (schema.kind === "primitive" || schema.kind === "array") {
    return { ...schema, optional };
  }
  return schema;
}

function applyFieldNullability(schema: Schema, sample: unknown): Schema {
  if (schema.kind !== "object") return schema;
  if (sample === null || sample === undefined || typeof sample !== "object" || Array.isArray(sample)) {
    return schema;
  }
  const sampleObj = sample as Record<string, unknown>;
  const fields: Record<string, Schema> = {};
  for (const [k, fieldSchema] of Object.entries(schema.fields)) {
    const sampleValue = sampleObj[k];
    if (sampleValue === null && (fieldSchema.kind === "primitive" || fieldSchema.kind === "array")) {
      fields[k] = { ...fieldSchema, nullable: true };
    } else if (fieldSchema.kind === "object") {
      fields[k] = applyFieldNullability(fieldSchema, sampleValue);
    } else {
      fields[k] = fieldSchema;
    }
  }
  return { kind: "object", fields };
}

export function infer(samples: unknown[]): Schema {
  if (samples.length === 0) return { kind: "unknown" };
  const nonNull = samples.filter((s) => s !== null && s !== undefined);
  if (nonNull.length === 0) return { kind: "unknown" };
  let merged: Schema = { kind: "unknown" };
  for (const s of nonNull) {
    merged = mergeSchemas(merged, inferOne(s));
  }
  for (const sample of samples) {
    merged = applyFieldNullability(merged, sample);
  }
  return merged;
}
