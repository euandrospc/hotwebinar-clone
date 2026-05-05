import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WaitingTemplatePicker } from "@/components/wizard/waiting-template-picker";

describe("WaitingTemplatePicker", () => {
  it("renders 5 cards with template labels", () => {
    render(<WaitingTemplatePicker value="DEFAULT" onChange={() => {}} />);
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("Com thumbnail")).toBeInTheDocument();
    expect(screen.getByText("Imersivo")).toBeInTheDocument();
    expect(screen.getByText("Minimalista")).toBeInTheDocument();
    expect(screen.getByText("Com benefícios")).toBeInTheDocument();
  });

  it("calls onChange with template id when clicked", () => {
    const onChange = vi.fn();
    render(<WaitingTemplatePicker value="DEFAULT" onChange={onChange} />);
    fireEvent.click(screen.getByText("Imersivo"));
    expect(onChange).toHaveBeenCalledWith("IMMERSIVE");
  });

  it("highlights selected card via aria-pressed", () => {
    render(<WaitingTemplatePicker value="MINIMAL" onChange={() => {}} />);
    const cards = screen.getAllByRole("button");
    const minimalCard = cards.find((c) => c.textContent?.includes("Minimalista"));
    expect(minimalCard).toHaveAttribute("aria-pressed", "true");
  });
});
