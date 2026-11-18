import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeBreadcrumbV5 } from "@/components/webinar/realtime-breadcrumb-v5";

const navigation = vi.hoisted(() => ({ push: vi.fn(), query: "demo=0" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

beforeEach(() => {
  navigation.push.mockReset();
  navigation.query = "demo=0";
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("v5 webinar breadcrumb", () => {
  it("switches webinars within the isolated v5 route and preserves the current query", async () => {
    render(<RealtimeBreadcrumbV5 webinarId="first" webinarTitle="Current webinar" webinars={[
      { id: "first", title: "Current webinar" },
      { id: "next webinar", title: "Next webinar" },
    ]} />);

    const trigger = screen.getByRole("combobox", { name: "Select webinar" });
    expect(trigger).toHaveTextContent("Current webinar");
    await act(async () => {
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "Enter" });
    });
    const next = screen.getByRole("option", { name: "Next webinar" });
    await act(async () => {
      next.focus();
      fireEvent.keyDown(next, { key: "Enter" });
    });

    expect(navigation.push).toHaveBeenCalledWith("/dashboard/webinars/next%20webinar/v5?demo=0", { scroll: false });
    expect(screen.getByRole("link", { name: "Webinars" })).toHaveAttribute("href", "/dashboard/webinars");
  });

  it("keeps the selected webinar title when it is the only authorized option", () => {
    render(<RealtimeBreadcrumbV5 webinarId="first" webinarTitle="Authorized webinar" webinars={[]} />);
    expect(screen.getByRole("combobox", { name: "Select webinar" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Select webinar" })).toHaveTextContent("Authorized webinar");
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
