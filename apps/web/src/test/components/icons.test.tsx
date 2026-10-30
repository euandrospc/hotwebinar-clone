import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Check, LoaderCircle, Search } from "@/components/icons";

describe("ClickUp icons", () => {
  it("keeps decorative icons out of the accessible name of buttons", () => {
    render(<button><Check />Confirmar</button>);
    const button = screen.getByRole("button", { name: "Confirmar" });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button.querySelector("svg")).toHaveAttribute("data-icon", "ui/check");
  });

  it("exposes labelled icons and forwards refs, size and theme classes", () => {
    const ref = createRef<SVGSVGElement>();
    render(<Search ref={ref} aria-label="Pesquisar" size={20} className="text-primary" />);
    const icon = screen.getByRole("img", { name: "Pesquisar" });
    expect(icon).not.toHaveAttribute("aria-hidden");
    expect(icon).toHaveAttribute("width", "20");
    expect(icon).toHaveAttribute("fill", "currentColor");
    expect(icon).toHaveClass("text-primary");
    expect(ref.current).toBe(icon);
  });

  it("preserves the original non-square-scale viewBox and spinner opacity", () => {
    render(<LoaderCircle title="Carregando" className="animate-spin" />);
    const icon = screen.getByRole("img", { name: "Carregando" });
    expect(icon).toHaveAttribute("viewBox", "0 0 16 16");
    expect(icon).toHaveClass("animate-spin");
    expect(icon.querySelector('[fill-opacity=".333"]')).not.toBeNull();
  });
});
