import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfferBanner } from "@/app/[slug]/_components/offer-banner";
import type { PlayerOffer } from "@/app/[slug]/_lib/public-types";

const baseOffer: PlayerOffer = {
  name: "X", title: "Y",
  priceOriginal: "R$2.997", priceFinal: "12x R$153.44",
  buttonText: "QUERO!", buttonColor: "#dc2626",
  imageDesktopUrl: "https://cdn.example.com/d.png",
  imageMobileUrl: "https://cdn.example.com/m.png",
  showAtSec: 100, hideAtSec: 200,
  link: "https://buy.example.com/x",
  passUtms: false, disabled: false, sameWindow: false, raffleEnabled: false
};

const baseLead = {
  id: "l1", name: "L",
  sessionStart: new Date().toISOString(),
  utmSource: "fb", utmMedium: "cpc", utmCampaign: "launch",
  utmTerm: null, utmContent: null
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  vi.stubGlobal("open", vi.fn());
});

describe("OfferBanner", () => {
  it("does not render before showAtSec", () => {
    render(<OfferBanner webinarId="webinar" offer={baseOffer} lead={baseLead} currentTimeSec={50} />);
    expect(screen.queryByRole("button", { name: /QUERO/ })).toBeNull();
  });
  it("does not render after hideAtSec", () => {
    render(<OfferBanner webinarId="webinar" offer={baseOffer} lead={baseLead} currentTimeSec={300} />);
    expect(screen.queryByRole("button", { name: /QUERO/ })).toBeNull();
  });
  it("renders inside window with correct color", () => {
    render(<OfferBanner webinarId="webinar" offer={baseOffer} lead={baseLead} currentTimeSec={150} />);
    const btn = screen.getByRole("button", { name: /QUERO/ });
    expect(btn).toHaveStyle({ backgroundColor: "#dc2626" });
  });
  it("never renders when offer.disabled", () => {
    render(<OfferBanner webinarId="webinar" offer={{ ...baseOffer, disabled: true }} lead={baseLead} currentTimeSec={150} />);
    expect(screen.queryByRole("button", { name: /QUERO/ })).toBeNull();
  });
  it("opens link with UTMs appended when passUtms=true", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<OfferBanner webinarId="webinar" offer={{ ...baseOffer, passUtms: true }} lead={baseLead} currentTimeSec={150} />);
    fireEvent.click(screen.getByRole("button", { name: /QUERO/ }));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("utm_source=fb"),
      "_blank",
      "noopener,noreferrer"
    );
  });
  it("opens with target=_self when sameWindow=true", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<OfferBanner webinarId="webinar" offer={{ ...baseOffer, sameWindow: true }} lead={baseLead} currentTimeSec={150} />);
    fireEvent.click(screen.getByRole("button", { name: /QUERO/ }));
    expect(open).toHaveBeenCalledWith(expect.any(String), "_self", "noopener,noreferrer");
    expect(fetch).toHaveBeenCalledWith("/api/offer-click?webinarId=webinar&leadId=l1", { method: "POST", keepalive: true });
  });
  it("attributes a verified A/B checkout after forwarding campaign UTMs", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<OfferBanner webinarId="webinar" offer={{ ...baseOffer, link: "https://pay.kirvano.com/x", passUtms: true, abLeadAttribution: true }} lead={{ ...baseLead, utmContent: "creative" }} currentTimeSec={150} />);
    fireEvent.click(screen.getByRole("button", { name: /QUERO/ }));
    const url = new URL(open.mock.calls[0][0]);
    expect(url.searchParams.get("utm_content")).toBe("creative|hw_ab_lead=l1");
    expect(url.searchParams.get("utm_source")).toBe("fb");
  });
  it("preserves ordinary webinar checkout links", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<OfferBanner webinarId="webinar" offer={{ ...baseOffer, link: "https://pay.kirvano.com/x?utm_content=creative" }} lead={baseLead} currentTimeSec={150} />);
    fireEvent.click(screen.getByRole("button", { name: /QUERO/ }));
    expect(open.mock.calls[0][0]).toBe("https://pay.kirvano.com/x?utm_content=creative");
  });
  it("shows raffle badge when raffle enabled", () => {
    render(<OfferBanner webinarId="webinar" offer={{ ...baseOffer, raffleEnabled: true }} lead={baseLead} currentTimeSec={150} />);
    expect(screen.getByText(/Sorteio/i)).toBeInTheDocument();
  });
});
