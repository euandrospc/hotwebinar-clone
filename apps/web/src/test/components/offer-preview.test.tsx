import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfferPreviewDesktop, OfferPreviewMobile } from "@/components/wizard/offer-preview";

const baseOffer = {
  offerName: "X", offerTitle: "Domine Y",
  offerPriceOriginal: "R$2.997", offerPriceFinal: "12x de R$153.44",
  offerButtonText: "QUERO APROVEITAR!",
  offerButtonColor: "#dc2626",
  offerImageDesktopUrl: "https://cdn.example.com/d.png",
  offerImageMobileUrl: "https://cdn.example.com/m.png",
  offerRaffleEnabled: false
};

describe("OfferPreviewDesktop", () => {
  it("renders prices, button text, and applies the button color", () => {
    render(<OfferPreviewDesktop {...baseOffer} />);
    expect(screen.getByText(/De R\$2\.997/)).toBeInTheDocument();
    expect(screen.getByText(/Por 12x de R\$153\.44/)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /QUERO APROVEITAR/ });
    expect(btn).toHaveStyle({ backgroundColor: "#dc2626" });
  });
  it("shows raffle badge when raffle enabled", () => {
    render(<OfferPreviewDesktop {...baseOffer} offerRaffleEnabled />);
    expect(screen.getByText(/Sorteio/i)).toBeInTheDocument();
  });
  it("renders no img when desktop image URL is missing", () => {
    render(<OfferPreviewDesktop {...baseOffer} offerImageDesktopUrl={null} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("OfferPreviewMobile", () => {
  it("renders compact mobile strip", () => {
    render(<OfferPreviewMobile {...baseOffer} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.example.com/m.png");
  });
  it("renders a placeholder when mobile image URL is missing", () => {
    render(<OfferPreviewMobile {...baseOffer} offerImageMobileUrl={null} />);
    expect(screen.getByText(/Prévia da oferta para mobile/i)).toBeInTheDocument();
  });
});
