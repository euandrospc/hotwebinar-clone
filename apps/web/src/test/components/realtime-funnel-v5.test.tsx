import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FunnelStage } from "@/lib/dashboard-stats";
import { RealtimeFunnelV5 } from "@/components/webinar/realtime-funnel-v5";

const stages = (counts: number[]): FunnelStage[] => counts.map((count, index) => ({ label: `Source ${index}`, count, pct: 999 }));
afterEach(cleanup);

describe("realtime funnel without commercial chart runtime", () => {
  it("preserves independent counts, growing stages and percentages over visitors", () => {
    const { container } = render(<RealtimeFunnelV5 stages={stages([10, 40, 20, 0, 5])} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map(button => button.getAttribute("aria-label"))).toEqual([
      "Visitors: 10 · 100% of visitors", "Watched: 40 · 400% of visitors", "Reached pitch: 20 · 200% of visitors",
      "Clicked offer: 0 · 0% of visitors", "Purchased: 5 · 50% of visitors",
    ]);
    const sections = [...container.querySelectorAll("[data-funnel-section]")];
    const leftTop = (index: number) => Number(sections[index].getAttribute("d")!.split(" ")[2]);
    // A later, larger count must genuinely widen the drawing, not just its label.
    expect(leftTop(1)).toBeLessThan(leftTop(0));
    expect(leftTop(3)).toBe(70);
    expect(container.textContent).not.toMatch(/license|MUI X/i);
  });

  it("shows exact zeros and an empty state, without percentages when no visitor base exists", () => {
    render(<RealtimeFunnelV5 stages={stages([0, 0, 0, 0, 0])} />);
    expect(screen.getByText("No activity today")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    items.forEach(item => {
      expect(within(item).getByText("0")).toBeInTheDocument();
      expect(within(item).getByText("—")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps later nonzero stages when visitors are zero, with undefined percentages", () => {
    render(<RealtimeFunnelV5 stages={stages([0, 50, 10, 0, 4])} />);
    expect(screen.getByRole("button", { name: "Watched: 50 · — of visitors" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visitors: 0 · — of visitors" })).toBeInTheDocument();
    expect(screen.queryByText("No activity today")).not.toBeInTheDocument();
  });

  it("distinguishes missing or malformed data from measured zero", () => {
    const { rerender } = render(<RealtimeFunnelV5 />);
    expect(screen.getByText("Funnel data unavailable")).toBeInTheDocument();
    for (const counts of [[1, 2], [1, 2, 3, 4, -1], [1, 2, 3, 4, Number.NaN], [1, 2, 3, 4, 1.5]]) {
      rerender(<RealtimeFunnelV5 stages={stages(counts)} />);
      expect(screen.getByText("Funnel data unavailable")).toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    }
  });

  it("supports a single tab stop, arrow/Home/End navigation and Escape dismissal", () => {
    render(<RealtimeFunnelV5 stages={stages([100, 75, 50, 10, 2])} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.filter(button => button.tabIndex === 0)).toEqual([buttons[0]]);
    act(() => buttons[0].focus());
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(buttons[1]).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Watched75 · 75% of visitors");
    fireEvent.keyDown(buttons[1], { key: "End" });
    expect(buttons[4]).toHaveFocus();
    fireEvent.keyDown(buttons[4], { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(buttons[4]).toHaveFocus();
    fireEvent.keyDown(buttons[4], { key: "Home" });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(buttons[0], { key: "Tab" });
    expect(buttons.filter(button => button.tabIndex === 0)).toEqual([buttons[0]]);
  });

  it("exposes tiny or zero sections by hover/tap and updates the exact active value", async () => {
    const { container, rerender } = render(<RealtimeFunnelV5 stages={stages([100, 75, 50, 0, 2])} />);
    const zero = screen.getByRole("button", { name: "Clicked offer: 0 · 0% of visitors" });
    fireEvent.pointerEnter(zero, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Clicked offer0 · 0% of visitors");
    fireEvent.pointerLeave(zero, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(zero);
    const before = container.querySelector('[data-funnel-section="stage-3"]')!.getAttribute("d");
    rerender(<RealtimeFunnelV5 stages={stages([100, 75, 50, 8, 2])} />);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Clicked offer8 · 8% of visitors");
    expect(screen.getByRole("button", { name: "Clicked offer: 8 · 8% of visitors" })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('[data-funnel-section="stage-3"]')!.getAttribute("d")).not.toEqual(before));
  });
});
