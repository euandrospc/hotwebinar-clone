import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudienceChart } from "@/components/wizard/audience-chart";

describe("AudienceChart", () => {
  it("renders placeholder text in NONE mode", () => {
    render(<AudienceChart mode="NONE" min={50} max={500} duration={3600} seed="x" />);
    expect(screen.getByText(/desabilitado/i)).toBeInTheDocument();
  });
  it("renders SVG line for DYNAMIC mode", () => {
    const { container } = render(
      <AudienceChart mode="DYNAMIC" min={50} max={500} duration={3600} seed="x" />
    );
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });
  it("renders SVG line for FIXED mode", () => {
    const { container } = render(
      <AudienceChart mode="FIXED" min={50} max={500} duration={3600} seed="x" />
    );
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });
});
