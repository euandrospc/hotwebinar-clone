import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaptureForm } from "@/app/[slug]/_components/capture-form";
import type { PublicWebinar } from "@/lib/public-dto";

vi.mock("@/server/actions/public", () => ({ submitOptin: vi.fn() }));
vi.mock("@/app/[slug]/_components/phone-input", () => ({
  PhoneInput: (props: { defaultCountry?: string; placeholder?: string }) => (
    <input data-testid="phone" data-default-country={props.defaultCountry} placeholder={props.placeholder} readOnly />
  )
}));

function webinar(overrides: Partial<PublicWebinar> = {}): PublicWebinar {
  return {
    id: "w1", slug: "live-15h-py", title: "Aula", name: "Aula", mode: "UNICO",
    startDate: null, endDate: null, timezone: "America/Sao_Paulo",
    waitingTitle: "", waitingSubtitle: "", waitingShowThumb: false,
    logoUrl: null, primaryColor: null, loginButtonText: "Entrar", loginButtonColor: "#16a34a",
    nameEnabled: true, nameRequired: true, namePlaceholder: "Nome",
    emailEnabled: true, emailRequired: true, emailPlaceholder: "Email",
    phoneEnabled: true, phoneRequired: true, phonePlaceholder: "WhatsApp", phoneDefaultCountry: "BR",
    pitchAtSec: null, waitingTemplate: "DEFAULT", closedGroupUrl: null, loginLogoAlign: "CENTER",
    progressEnabled: false, progressStartPct: 50, progressBarColor: "#dc2626", progressTextColor: "#ffffff",
    progressText: "", formFieldOrder: ["name", "email", "phone"],
    audienceMode: "NONE", audienceMin: 0, audienceMax: 0, audienceLiveBadge: false,
    offerName: "", offerTitle: "", offerPriceOriginal: null, offerPriceFinal: null,
    offerButtonText: "", offerButtonColor: "#dc2626", offerImageDesktopUrl: null, offerImageMobileUrl: null,
    offerShowAtSec: null, offerHideAtSec: null, offerLink: null, offerPassUtms: false,
    offerDisabled: false, offerSameWindow: false, offerRaffleEnabled: false,
    ...overrides
  };
}

describe("CaptureForm phone country", () => {
  it("starts the WhatsApp field on the webinar's country", () => {
    render(<CaptureForm w={webinar({ phoneDefaultCountry: "PY" })} />);
    expect(screen.getByTestId("phone").getAttribute("data-default-country")).toBe("PY");
  });

  it("keeps Brazil for rooms configured with the default", () => {
    render(<CaptureForm w={webinar()} />);
    expect(screen.getByTestId("phone").getAttribute("data-default-country")).toBe("BR");
  });
});
