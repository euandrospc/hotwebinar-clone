import { describe, expect, it } from "vitest";
import { abReadinessIssues } from "@/server/ab-tests/readiness";

const webinar = { video: { status: "READY" as const, hlsUrl: "https://video.test/stream.m3u8", durationSec: 3600 }, pitchAtSec: 1800, offerDisabled: false, offerLink: "https://checkout.test/product", offerShowAtSec: 1800, offerHideAtSec: null };

describe("A/B measurement prerequisites", () => {
  it("requires usable video configuration for every webinar experiment", () => {
    for (const metric of ["PURCHASE", "PITCH_REACHED", "OFFER_CLICK"] as const) {
      expect(abReadinessIssues(webinar, metric)).toEqual([]);
      expect(abReadinessIssues({ ...webinar, video: null }, metric)).toContain("vincule um vídeo pronto para reprodução");
    }
  });
  it("rejects unreachable pitch and offer times", () => {
    expect(abReadinessIssues({ ...webinar, pitchAtSec: 3600 }, "PITCH_REACHED")).toContain("posicione o pitch antes do fim do vídeo");
    expect(abReadinessIssues({ ...webinar, offerShowAtSec: 3600 }, "OFFER_CLICK")).toContain("posicione a oferta antes do fim do vídeo");
    expect(abReadinessIssues({ ...webinar, offerHideAtSec: 1800 }, "OFFER_CLICK")).toContain("ajuste o fim da oferta para depois de sua exibição");
  });
  it("validates clickable links without claiming the checkout or integration works", () => {
    for (const offerLink of [null, "", "javascript:alert(1)", "https://user:secret@checkout.test"]) {
      expect(abReadinessIssues({ ...webinar, offerLink }, "OFFER_CLICK")).toContain("configure um link HTTP ou HTTPS válido para a oferta");
    }
    // Purchases can arrive through support or other channels; an on-player offer is not mandatory.
    expect(abReadinessIssues({ ...webinar, offerDisabled: true, offerLink: null }, "PURCHASE")).toEqual([]);
  });
});
