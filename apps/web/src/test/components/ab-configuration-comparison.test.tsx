import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbConfigurationComparison } from "@/components/ab-tests/ab-configuration-comparison";
import type { AbExperimentDto, AbVariantConfiguration } from "@/lib/ab-tests";

const configuration: AbVariantConfiguration = {
  version: 1, title: "Variante original", mode: "UNICO", timezone: "America/Sao_Paulo", startAt: "2026-11-10T23:00:00.000Z", endAt: null,
  recurring: true, recurringDays: [5, 1, 3], videoName: "Apresentação original", videoDurationSec: 3720, pitchAtSec: 0, videoSyncWithStart: true,
  offerTitle: "Mentoria", offerPriceOriginal: "R$ 2.000", offerPriceFinal: "12x de R$ 97,00", offerShowAtSec: 1800, offerHideAtSec: null,
  offerLink: "https://pay.example.test/offer", offerDisabled: false, offerButtonText: "Garantir minha vaga", offerPassUtms: true,
  accessFacilitated: false, fields: { name: true, email: true, phone: false }, chatAiEnabled: true, chatAiName: "Assistente", audienceMode: "DYNAMIC"
};
const makeExperiment = (overrides: Partial<AbExperimentDto> = {}): AbExperimentDto => ({
  id: "test-1", name: "Pitch cedo", hypothesis: "Um pitch direto aumenta a conversão.", mode: "RANDOMIZED", status: "RUNNING", metric: "PURCHASE",
  testVariable: "PITCH", variantADescription: "Pitch no início", variantBDescription: "Pitch após a abertura",
  configuration: { A: configuration, B: { ...configuration, title: "Variante alternativa", pitchAtSec: 155 }, frozen: true },
  webinarAId: "a", webinarBId: "b",
  webinarA: { id: "a", title: "Nome atual A", name: "A", slug: "a", status: "ACTIVE", mode: "UNICO" },
  webinarB: { id: "b", title: "Nome atual B", name: "B", slug: "b", status: "ACTIVE", mode: "UNICO" },
  baselineRate: .05, minimumDetectableLift: .2, sampleSizePerVariant: 8158, durationDays: 14, conversionWindowHours: 72,
  startedAt: "2026-11-10T03:00:00.000Z", endsAt: "2026-11-24T03:00:00.000Z", completedAt: null,
  createdAt: "2026-11-01T03:00:00.000Z", updatedAt: "2026-11-10T03:00:00.000Z", assignmentCount: 10, publicPath: "/ab/test-1", ...overrides
});
afterEach(cleanup);

describe("A/B configuration comparison", () => {
  it("shows frozen values, configured local time, unmodified price text and exact video positions", () => {
    render(<AbConfigurationComparison experiment={makeExperiment()} />);
    expect(screen.getByText("Configuração registrada ao iniciar")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /A Variante original Pitch no início/ })).toBeInTheDocument();
    expect(screen.queryByText("Nome atual A")).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Início programado/ })).toHaveTextContent(/10\/11\/2026.*20:00/);
    expect(screen.getByRole("row", { name: /Recorrência/ })).toHaveTextContent("Semanal · Seg, Qua, Sex");
    expect(screen.getByRole("row", { name: /Duração do vídeo/ })).toHaveTextContent("62:00");
    expect(screen.getByRole("row", { name: /Momento do pitch/ })).toHaveTextContent("00:00");
    expect(screen.getByRole("row", { name: /Momento do pitch/ })).toHaveTextContent("02:35");
    expect(screen.getByRole("row", { name: /Preço final/ })).toHaveTextContent("12x de R$ 97,00");
    expect(screen.getByRole("row", { name: /Modo do contador de audiência/ })).toHaveTextContent("não representa audiência real");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("filters only changed settings without treating variant names and descriptions as configuration differences", async () => {
    const user = userEvent.setup();
    render(<AbConfigurationComparison experiment={makeExperiment()} />);
    expect(screen.getByText("1 diferença")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Só diferenças" }));
    expect(screen.queryByRole("row", { name: /Preço final/ })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Momento do pitch/ })).toHaveTextContent("02:35");
    expect(screen.queryByRole("row", { name: /Horário e programação/ })).not.toBeInTheDocument();
    expect(screen.getByText("Pitch após a abertura")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Só diferenças" }));
    expect(screen.getByRole("row", { name: /Preço final/ })).toBeInTheDocument();
  });

  it("labels current historical values honestly and formats each variant in its own timezone", () => {
    render(<AbConfigurationComparison experiment={makeExperiment({ mode: "OBSERVATIONAL", status: "COMPLETED", configuration: {
      A: configuration, B: { ...configuration, timezone: "America/Manaus" }, frozen: false
    } })} />);
    expect(screen.getByText("Configuração atual dos webinars")).toBeInTheDocument();
    expect(screen.getByText(/não reconstituem a configuração do período histórico/)).toBeInTheDocument();
    const cells = within(screen.getByRole("row", { name: /Início programado/ })).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("20:00"); expect(cells[1]).toHaveTextContent("19:00");
  });

  it("does not fabricate missing snapshots, links or differences", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AbConfigurationComparison experiment={makeExperiment({ configuration: undefined })} />);
    expect(screen.getByRole("status")).toHaveTextContent("indisponível");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const a = { ...configuration, offerLink: "javascript:alert(1)", pitchAtSec: null, videoDurationSec: null };
    rerender(<AbConfigurationComparison experiment={makeExperiment({ configuration: { A: a, B: a, frozen: false } })} />);
    expect(screen.getByText("Configuração atual · sem registro inicial")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Duração do vídeo/ })).toHaveTextContent("Não informado");
    await user.click(screen.getByRole("checkbox", { name: "Só diferenças" }));
    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma diferença nos campos comparados");
  });
});
