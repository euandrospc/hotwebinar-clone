import { describe, it, expect } from "vitest";
import { infer, mergeSchemas, type Schema } from "../../src/lib/schema-infer.js";

describe("schema-infer", () => {
  it("infers primitive types from a single sample", () => {
    expect(infer([{ id: 1, name: "a", active: true }])).toEqual<Schema>({
      kind: "object",
      fields: {
        id: { kind: "primitive", type: "number", optional: false, nullable: false },
        name: { kind: "primitive", type: "string", optional: false, nullable: false },
        active: { kind: "primitive", type: "boolean", optional: false, nullable: false },
      },
    });
  });

  it("marks fields optional when missing in some samples", () => {
    const s = infer([{ id: 1, name: "a" }, { id: 2 }]);
    expect(s).toEqual<Schema>({
      kind: "object",
      fields: {
        id: { kind: "primitive", type: "number", optional: false, nullable: false },
        name: { kind: "primitive", type: "string", optional: true, nullable: false },
      },
    });
  });

  it("marks fields nullable when null seen", () => {
    const s = infer([{ id: 1, name: null }, { id: 2, name: "b" }]);
    expect(s.kind).toBe("object");
    if (s.kind !== "object") return;
    expect(s.fields.name).toEqual({ kind: "primitive", type: "string", optional: false, nullable: true });
  });

  it("infers arrays of primitives", () => {
    const s = infer([{ tags: ["a", "b"] }]);
    if (s.kind !== "object") throw new Error("expected object");
    expect(s.fields.tags).toEqual({
      kind: "array",
      element: { kind: "primitive", type: "string", optional: false, nullable: false },
      optional: false,
      nullable: false,
    });
  });

  it("infers arrays of objects by merging element schemas", () => {
    const s = infer([{ items: [{ a: 1 }, { a: 2, b: "x" }] }]);
    if (s.kind !== "object") throw new Error("expected object");
    const arr = s.fields.items;
    if (arr.kind !== "array" || arr.element.kind !== "object") throw new Error("expected array of objects");
    expect(arr.element.fields.a).toEqual({
      kind: "primitive", type: "number", optional: false, nullable: false,
    });
    expect(arr.element.fields.b).toEqual({
      kind: "primitive", type: "string", optional: true, nullable: false,
    });
  });

  it("infers nested objects", () => {
    const s = infer([{ user: { id: 1, email: "x@y" } }]);
    if (s.kind !== "object") throw new Error();
    expect(s.fields.user.kind).toBe("object");
  });

  it("returns unknown for empty samples", () => {
    expect(infer([])).toEqual({ kind: "unknown" });
  });

  it("handles top-level arrays", () => {
    const s = infer([[{ id: 1 }, { id: 2 }]]);
    expect(s.kind).toBe("array");
  });

  it("mergeSchemas merges two object schemas", () => {
    const a: Schema = { kind: "object", fields: { id: { kind: "primitive", type: "number", optional: false, nullable: false } } };
    const b: Schema = { kind: "object", fields: { id: { kind: "primitive", type: "number", optional: false, nullable: false }, name: { kind: "primitive", type: "string", optional: false, nullable: false } } };
    const m = mergeSchemas(a, b);
    if (m.kind !== "object") throw new Error("expected object");
    expect(m.fields.id.kind).toBe("primitive");
    expect(m.fields.name).toEqual({ kind: "primitive", type: "string", optional: true, nullable: false });
  });

  it("merge(unknown, X) returns X (identity)", () => {
    const prim: Schema = { kind: "primitive", type: "string", optional: false, nullable: false };
    expect(mergeSchemas({ kind: "unknown" }, prim)).toEqual(prim);
    expect(mergeSchemas(prim, { kind: "unknown" })).toEqual(prim);
  });

  it("merges mismatched primitive types to unknown", () => {
    const a: Schema = { kind: "primitive", type: "string", optional: false, nullable: false };
    const b: Schema = { kind: "primitive", type: "number", optional: false, nullable: false };
    expect(mergeSchemas(a, b)).toEqual({ kind: "unknown" });
  });

  it("merges mismatched kinds (array vs object) to unknown", () => {
    const arr: Schema = { kind: "array", element: { kind: "unknown" }, optional: false, nullable: false };
    const obj: Schema = { kind: "object", fields: {} };
    expect(mergeSchemas(arr, obj)).toEqual({ kind: "unknown" });
  });

  it("infers mixed-primitive arrays as unknown element", () => {
    const s = infer([{ items: [1, "a"] }]);
    if (s.kind !== "object") throw new Error("expected object");
    const arr = s.fields.items;
    if (arr.kind !== "array") throw new Error("expected array");
    expect(arr.element).toEqual({ kind: "unknown" });
  });

  it("marks array element nullable when null appears in array", () => {
    const s = infer([{ tags: ["a", null, "b"] }]);
    if (s.kind !== "object") throw new Error("expected object");
    const arr = s.fields.tags;
    if (arr.kind !== "array" || arr.element.kind !== "primitive") throw new Error("expected primitive array");
    expect(arr.element.nullable).toBe(true);
    expect(arr.element.type).toBe("string");
  });

  it("marks nested object field nullable when null sample seen", () => {
    const s = infer([{ user: { id: 1 } }, { user: null }]);
    if (s.kind !== "object") throw new Error("expected object");
    const user = s.fields.user;
    if (user.kind !== "object") throw new Error("expected object");
    expect(user.nullable).toBe(true);
  });
});
