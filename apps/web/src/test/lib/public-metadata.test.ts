import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "" }) }));

describe("metadata raiz", () => {
  it("não expõe descrição na prévia dos links públicos", async () => {
    const { metadata } = await import("@/app/layout");

    // As páginas públicas herdam este objeto: qualquer descrição aqui aparece no preview do link.
    expect(metadata.description).toBeUndefined();
  });
});
