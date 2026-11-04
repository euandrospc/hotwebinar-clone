import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DashboardRangePicker } from "@/components/dashboard/dashboard-range-picker";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dashboard" }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T15:00:00Z"));
  push.mockReset();
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const props = { initialFrom: "2026-11-04", initialTo: "2026-11-04", initialFromTime: "00:00", initialToTime: "23:59" };
const open = () => fireEvent.click(screen.getByRole("button", { name: /04\/11\/2026/ }));
it("reuses presets in callback mode without navigating away from the inbox", () => {
  const apply = vi.fn();
  render(<DashboardRangePicker {...props} onApply={apply} timeZone="America/Sao_Paulo" />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Ontem" }));
  expect(apply).toHaveBeenCalledWith({ from: "2026-11-03", to: "2026-11-03", fromTime: "00:00", toTime: "23:59" });
  expect(push).not.toHaveBeenCalled();
});
it("only applies edited hours on Apply, and Cancel restores the prior values", () => {
  const apply = vi.fn();
  render(<DashboardRangePicker {...props} onApply={apply} />);
  open();
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "14:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(apply).not.toHaveBeenCalled();
  open();
  expect(screen.getByLabelText("Início")).toHaveValue("00:00");
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "14:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ fromTime: "14:00" }));
});
it("preserves the existing dashboard navigation behavior", () => {
  render(<DashboardRangePicker {...props} />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Ontem" }));
  const url = new URL(push.mock.calls[0][0], "http://localhost");
  expect(url.pathname).toBe("/dashboard");
  expect(url.searchParams.get("from")).toBe("2026-11-03T00:00:00");
  expect(url.searchParams.get("to")).toBe("2026-11-03T23:59:00");
});
