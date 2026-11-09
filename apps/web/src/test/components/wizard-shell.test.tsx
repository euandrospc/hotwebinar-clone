import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WizardShell } from "@/components/wizard/wizard-shell";

const route = vi.hoisted(() => ({ pathname: "/dashboard/webinars/w1/step-1" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

const scrollTo = vi.fn(function (this: HTMLElement, options?: ScrollToOptions | number) {
  this.scrollLeft = typeof options === "number" ? options : options?.left ?? 0;
});

function rect(left: number, width: number): DOMRect {
  return { x: left, y: 130, left, right: left + width, top: 130, bottom: 178, width, height: 48, toJSON: () => ({}) };
}

beforeEach(() => {
  route.pathname = "/dashboard/webinars/w1/step-1";
  scrollTo.mockClear();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.tagName === "NAV") {
      Object.defineProperties(this, {
        clientWidth: { configurable: true, value: 300 },
        scrollWidth: { configurable: true, value: 900 }
      });
      this.scrollTo = scrollTo;
      return rect(10, 300);
    }
    const nav = this.closest("nav");
    if (this.tagName === "A" && nav) {
      const index = Array.from(nav.querySelectorAll("a")).indexOf(this as HTMLAnchorElement);
      return rect(10 + index * 100 - nav.scrollLeft, 90);
    }
    return rect(0, 0);
  });
});

afterEach(() => vi.restoreAllMocks());

describe("WizardShell mobile navigation", () => {
  it("reveals the active offer step on direct entry without scrolling vertically", () => {
    route.pathname = "/dashboard/webinars/w1/step-5";
    render(<WizardShell webinarId="w1">Formulário</WizardShell>);
    expect(scrollTo).toHaveBeenCalledWith({ left: 295, behavior: "auto" });
    expect(screen.getByRole("link", { name: "Oferta 05" })).toHaveAttribute("aria-current", "step");
  });

  it("reveals integrations while keeping every step available", () => {
    route.pathname = "/dashboard/webinars/w1/integrations";
    render(<WizardShell webinarId="w1">Formulário</WizardShell>);
    expect(scrollTo).toHaveBeenCalledWith({ left: 600, behavior: "auto" });
    expect(within(screen.getByRole("navigation", { name: "Etapas do webinar" })).getAllByRole("link")).toHaveLength(9);
  });

  it("leaves visible steps still and follows forward and backward navigation", () => {
    const { rerender } = render(<WizardShell webinarId="w1">Formulário</WizardShell>);
    expect(scrollTo).not.toHaveBeenCalled();
    route.pathname = "/dashboard/webinars/w1/step-5";
    rerender(<WizardShell webinarId="w1">Formulário</WizardShell>);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 295, behavior: "auto" });
    route.pathname = "/dashboard/webinars/w1/step-1";
    rerender(<WizardShell webinarId="w1">Formulário</WizardShell>);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "auto" });
  });
});
