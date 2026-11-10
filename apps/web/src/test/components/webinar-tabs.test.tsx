import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn()
}));

describe("WebinarTabs", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/webinars/w1/metrics");
  });

  it("renders the six webinar tab links", () => {
    render(<WebinarTabs webinarId="w1" />);
    for (const label of ["Editor", "Leads", "Métricas", "Tempo real", "Agente IA", "Webhooks"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(screen.queryByRole("link", { name: "Mapa" })).not.toBeInTheDocument();
  });
  it("Editor href points to step-1; other tabs point to their suffix", () => {
    render(<WebinarTabs webinarId="w1" />);
    expect(screen.getByText("Editor").getAttribute("href")).toBe("/dashboard/webinars/w1/step-1");
    expect(screen.getByText("Leads").getAttribute("href")).toBe("/dashboard/webinars/w1/leads");
    expect(screen.getByText("Métricas").getAttribute("href")).toBe("/dashboard/webinars/w1/metrics");
    expect(screen.getByText("Tempo real").getAttribute("href")).toBe("/dashboard/webinars/w1/realtime");
    expect(screen.getByText("Agente IA").getAttribute("href")).toBe("/dashboard/webinars/w1/chat-ai");
    expect(screen.getByText("Webhooks").getAttribute("href")).toBe("/dashboard/webinars/w1/webhooks");
  });
  it.each([
    ["Métricas", "metrics"],
    ["Tempo real", "realtime"]
  ])("marks only %s as the current page for its route", (label, suffix) => {
    vi.mocked(usePathname).mockReturnValue(`/dashboard/webinars/w1/${suffix}`);
    render(<WebinarTabs webinarId="w1" />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
  });
});
