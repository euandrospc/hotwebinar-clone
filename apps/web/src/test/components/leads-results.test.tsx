import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadsResults } from "@/components/webinar/leads-results";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(cleanup);
beforeEach(() => push.mockReset());

const baseHref = "/dashboard/webinars/w1/leads";
const filters = {
  q: "João & Ana",
  from: "2026-11-01T00:00:00-03:00",
  to: "2026-11-10T23:59:59.999-03:00",
  clicked: "1"
};
const top = () => within(screen.getByRole("navigation", { name: "Paginação de leads (início)" }));
const bottom = () => within(screen.getByRole("navigation", { name: "Paginação de leads (fim)" }));

function result(page = 1, pageSize = 25, total = 87) {
  return <LeadsResults baseHref={baseHref} filters={filters} page={page} pageSize={pageSize} total={total}>
    <table><tbody><tr><td>Lead da página atual</td></tr></tbody></table>
  </LeadsResults>;
}

function expectNavigation(page: number, pageSize: number) {
  const [href, options] = push.mock.calls.at(-1)!;
  const url = new URL(href, "https://example.test");
  expect(url.pathname).toBe(baseHref);
  expect(Object.fromEntries(url.searchParams)).toEqual({ ...filters, page: String(page), pageSize: String(pageSize) });
  expect(options).toEqual({ scroll: false });
}

describe("LeadsResults pagination", () => {
  it("shows the result range and page controls both above and below the table", () => {
    render(result());
    expect(screen.getAllByText("1–25 de 87")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Página 1 de 4. 1–25 de 87.");
    expect(screen.getByRole("combobox", { name: "Registros por página" })).toHaveValue("25");
    expect(screen.getByRole("table")).toHaveTextContent("Lead da página atual");
    for (const nav of [top(), bottom()]) {
      expect(nav.getByRole("button", { name: "Página anterior" })).toBeDisabled();
      expect(nav.getByRole("button", { name: "Próxima página" })).toBeEnabled();
      expect(nav.getByRole("button", { name: "Página 1" })).toHaveAttribute("aria-current", "page");
    }
  });

  it("disables advancing past the final partial page", async () => {
    const user = userEvent.setup();
    render(result(4));
    expect(screen.getAllByText("76–87 de 87")).toHaveLength(2);
    for (const nav of [top(), bottom()]) {
      expect(nav.getByRole("button", { name: "Próxima página" })).toBeDisabled();
      expect(nav.getByRole("button", { name: "Página anterior" })).toBeEnabled();
      await user.click(nav.getByRole("button", { name: "Próxima página" }));
    }
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps an empty result on page one with both directions disabled", () => {
    render(result(1, 25, 0));
    expect(screen.getAllByText("0 registros")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Página 1 de 1. 0 registros.");
    for (const nav of [top(), bottom()]) {
      expect(nav.getByRole("button", { name: "Página anterior" })).toBeDisabled();
      expect(nav.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    }
    expect(document.body).not.toHaveTextContent(/NaN|Infinity|1–0/);
  });

  it("changes pages through the router while preserving the complete filter and scroll state", async () => {
    const user = userEvent.setup();
    render(result(2));
    await user.click(top().getByRole("button", { name: "Próxima página" }));
    expectNavigation(3, 25);
    await user.click(bottom().getByRole("button", { name: "Página anterior" }));
    expectNavigation(1, 25);
    await user.click(top().getByRole("button", { name: "Página 4" }));
    expectNavigation(4, 25);
    expect(push).toHaveBeenCalledTimes(3);
  });

  it.each([25, 50, 100])("resets to page one when selecting %i records without dropping filters", async (size) => {
    const user = userEvent.setup();
    render(result(3, size === 25 ? 50 : 25, 300));
    await user.selectOptions(screen.getByRole("combobox", { name: "Registros por página" }), String(size));
    expectNavigation(1, size);
  });

  it("does not request the same page again when its active number is clicked", async () => {
    const user = userEvent.setup();
    render(result(2));
    await user.click(top().getByRole("button", { name: "Página 2" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the controls bounded for a large dataset and allows jumping to its last page", async () => {
    const user = userEvent.setup();
    render(result(20_000, 25, 1_000_000));
    expect(top().getAllByRole("button").length).toBeLessThanOrEqual(7);
    expect(top().getByRole("button", { name: "Página 20.000" })).toHaveAttribute("aria-current", "page");
    await user.click(top().getByRole("button", { name: "Página 40.000" }));
    expectNavigation(40_000, 25);
  });
});
