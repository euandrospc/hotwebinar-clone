import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/webinars/w1/leads-map"
}));

describe("WebinarTabs", () => {
  it("renders 5 tab links", () => {
    render(<WebinarTabs webinarId="w1" />);
    for (const label of ["Editor", "Leads", "Mapa", "Métricas", "Webhooks"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
  it("Editor href points to step-1; other tabs point to their suffix", () => {
    render(<WebinarTabs webinarId="w1" />);
    expect(screen.getByText("Editor").getAttribute("href")).toBe("/dashboard/webinars/w1/step-1");
    expect(screen.getByText("Leads").getAttribute("href")).toBe("/dashboard/webinars/w1/leads");
    expect(screen.getByText("Mapa").getAttribute("href")).toBe("/dashboard/webinars/w1/leads-map");
    expect(screen.getByText("Métricas").getAttribute("href")).toBe("/dashboard/webinars/w1/metrics");
    expect(screen.getByText("Webhooks").getAttribute("href")).toBe("/dashboard/webinars/w1/webhooks");
  });
  it("marks Mapa as active when pathname matches leads-map", () => {
    render(<WebinarTabs webinarId="w1" />);
    const mapaLink = screen.getByText("Mapa");
    expect(mapaLink.className).toMatch(/border-primary/);
  });
});
