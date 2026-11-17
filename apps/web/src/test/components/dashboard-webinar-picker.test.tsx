import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DashboardWebinarPicker } from "@/components/dashboard/dashboard-webinar-picker";

const navigation = vi.hoisted(() => ({ push: vi.fn(), query: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(navigation.query)
}));

const webinars = [
  { id: "webinar-1", title: "Webinar das 10h", status: "ACTIVE" },
  { id: "webinar-2", title: "Webinar das 20h", status: "ACTIVE" }
];

beforeEach(() => {
  navigation.push.mockReset();
  navigation.query = "webinarId=webinar-1&from=2026-11-01&to=2026-11-16&demo=0&extra=kept";
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

function openPicker() {
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Webinar analisado" }), { key: "ArrowDown" });
}

describe("Dashboard webinar selection", () => {
  it("offers Todos and preserves the date range and other query parameters when selected", () => {
    render(<DashboardWebinarPicker webinars={webinars} selectedId="webinar-1" compact />);
    openPicker();
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Todos", "Webinar das 10h", "Webinar das 20h"]);
    fireEvent.keyDown(screen.getByRole("option", { name: "Todos" }), { key: "Enter" });

    expect(navigation.push).toHaveBeenCalledOnce();
    const url = new URL(navigation.push.mock.calls[0][0], "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      webinarId: "all", from: "2026-11-01", to: "2026-11-16", demo: "0", extra: "kept"
    });
    expect(navigation.push.mock.calls[0][1]).toEqual({ scroll: false });
  });

  it("displays Todos as selected and allows returning to an individual webinar", () => {
    navigation.query = "webinarId=all&from=2026-11-01&to=2026-11-16";
    render(<DashboardWebinarPicker webinars={webinars} selectedId="all" compact />);
    expect(screen.getByRole("combobox", { name: "Webinar analisado" })).toHaveTextContent("Todos");
    openPicker();
    expect(screen.getByRole("option", { name: "Todos" })).toHaveAttribute("data-state", "checked");
    fireEvent.keyDown(screen.getByRole("option", { name: "Webinar das 20h" }), { key: "Enter" });

    const url = new URL(navigation.push.mock.calls[0][0], "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ webinarId: "webinar-2", from: "2026-11-01", to: "2026-11-16" });
  });

  it("does not navigate when Todos is already selected", () => {
    render(<DashboardWebinarPicker webinars={webinars} selectedId="all" />);
    openPicker();
    fireEvent.keyDown(screen.getByRole("option", { name: "Todos" }), { key: "Enter" });
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
