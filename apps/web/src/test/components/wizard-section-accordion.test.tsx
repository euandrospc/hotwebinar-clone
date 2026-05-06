import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WizardSectionAccordion } from "@/components/wizard/wizard-section-accordion";

describe("WizardSectionAccordion", () => {
  it("renders 3 triggers (AI / arquivo / individual)", () => {
    render(
      <WizardSectionAccordion
        ai={<div>Automação Inteligente</div>}
        fileTitle="Crie via arquivo"
        fileSection={<div>FILE</div>}
        individualTitle="Crie individual"
        individualSection={<div>INDIVIDUAL</div>}
      />
    );
    expect(screen.getByText(/Automação/i)).toBeInTheDocument();
    expect(screen.getByText("Crie via arquivo")).toBeInTheDocument();
    expect(screen.getByText("Crie individual")).toBeInTheDocument();
  });
  it("expands a section when its trigger is clicked", () => {
    render(
      <WizardSectionAccordion
        ai={<div>AI content</div>}
        fileTitle="Crie via arquivo"
        fileSection={<div>FILE_SECTION</div>}
        individualTitle="Crie individual"
        individualSection={<div>INDIVIDUAL_SECTION</div>}
      />
    );
    fireEvent.click(screen.getByText("Crie via arquivo"));
    expect(screen.getByText("FILE_SECTION")).toBeInTheDocument();
  });
});
