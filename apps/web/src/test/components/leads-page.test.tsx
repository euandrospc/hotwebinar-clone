import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import LeadsPage from "@/app/dashboard/webinars/[id]/leads/page";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findWebinar: vi.fn(),
  count: vi.fn(),
  findLeads: vi.fn(),
  push: vi.fn(),
  replace: vi.fn()
}));

vi.mock("db", () => ({
  prisma: {
    webinar: { findUnique: mocks.findWebinar },
    lead: { count: mocks.count, findMany: mocks.findLeads }
  }
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => "/dashboard/webinars/webinar-1/leads",
  useSearchParams: () => new URLSearchParams()
}));
vi.mock("next/link", () => ({
  default: ({ children, prefetch: _prefetch, scroll: _scroll, replace: _replace, ...props }: ComponentProps<"a"> & {
    prefetch?: boolean | null; scroll?: boolean; replace?: boolean;
  }) => <a {...props}>{children}</a>
}));
vi.mock("next/form", () => ({
  default: ({ children, prefetch: _prefetch, scroll: _scroll, replace: _replace, ...props }: ComponentProps<"form"> & {
    prefetch?: boolean | null; scroll?: boolean; replace?: boolean;
  }) => <form {...props}>{children}</form>
}));
vi.mock("@/components/webinar/webinar-tabs", () => ({ WebinarTabs: () => null }));
vi.mock("@/components/dashboard/dashboard-range-picker", () => ({ DashboardRangePicker: () => null }));

type SearchParams = Awaited<Parameters<typeof LeadsPage>[0]["searchParams"]>;

const row = {
  id: "lead-26",
  name: "Pessoa da página atual",
  email: "pagina-atual@example.com",
  phone: null,
  city: "Curitiba",
  region: "PR",
  country: "BR",
  sessionStart: new Date("2026-11-10T12:00:00Z"),
  pitchFired: true,
  ctaClicks: 2
};

async function loadPage(searchParams: SearchParams = {}): Promise<ReactNode> {
  return LeadsPage({ params: Promise.resolve({ id: "webinar-1" }), searchParams: Promise.resolve(searchParams) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "owner-1" } });
  mocks.findWebinar.mockResolvedValue({ id: "webinar-1", ownerId: "owner-1", title: "Webinar de teste", name: "Webinar" });
  mocks.count.mockResolvedValue(73);
  mocks.findLeads.mockResolvedValue([row]);
});

afterEach(cleanup);

describe("Leads page server pagination", () => {
  it("loads only the first 25 records by default, with deterministic ordering", async () => {
    await loadPage({ period: "all" });

    expect(mocks.findLeads).toHaveBeenCalledOnce();
    expect(mocks.findLeads).toHaveBeenCalledWith(expect.objectContaining({
      take: 25,
      skip: 0,
      orderBy: [{ sessionStart: "desc" }, { id: "desc" }]
    }));
  });

  it.each([25, 50, 100])("fetches page two using the selected size of %i", async (pageSize) => {
    mocks.count.mockResolvedValue(240);
    render(await loadPage({ page: "2", pageSize: String(pageSize), period: "all" }));

    expect(mocks.findLeads).toHaveBeenCalledWith(expect.objectContaining({ take: pageSize, skip: pageSize }));
    expect(screen.getByRole("cell", { name: row.name })).toBeInTheDocument();
  });

  it("clamps an out-of-range page before querying rows", async () => {
    await loadPage({ page: "999999999", period: "all" });

    expect(mocks.findLeads).toHaveBeenCalledWith(expect.objectContaining({ take: 25, skip: 50 }));
  });

  it("does not allow an arbitrary page size to request an unbounded list", async () => {
    await loadPage({ pageSize: "500000", period: "all" });

    expect(mocks.findLeads).toHaveBeenCalledWith(expect.objectContaining({ take: 25, skip: 0 }));
  });

  it.each(["-2", "no-page", "1.5", "9999999999999999999999999999999999999"])(
    "never passes an invalid page (%s) through as a database offset",
    async (page) => {
      await loadPage({ page, period: "all" });
      const query = mocks.findLeads.mock.calls[0][0];
      expect(query.take).toBe(25);
      expect(Number.isSafeInteger(query.skip)).toBe(true);
      expect(query.skip).toBeGreaterThanOrEqual(0);
      expect(query.skip).toBeLessThanOrEqual(50);
    }
  );

  it("uses identical filters for the total and the requested page", async () => {
    await loadPage({
      q: "  Ana & Silva  ", clicked: "1", page: "2", pageSize: "25",
      from: "2026-11-01T00:00:00-03:00", to: "2026-11-10T23:59:00-03:00"
    });

    const countWhere = mocks.count.mock.calls[0][0].where;
    const listWhere = mocks.findLeads.mock.calls[0][0].where;
    expect(listWhere).toEqual(countWhere);
    expect(listWhere).toEqual({
      webinarId: "webinar-1",
      ctaClicks: { gt: 0 },
      sessionStart: {
        gte: new Date("2026-11-01T03:00:00Z"),
        lte: new Date("2026-11-11T02:59:59.999Z")
      },
      OR: [
        { name: { contains: "Ana & Silva", mode: "insensitive" } },
        { email: { contains: "Ana & Silva", mode: "insensitive" } },
        { city: { contains: "Ana & Silva", mode: "insensitive" } }
      ]
    });
  });

  it("exports the complete filtered result independently of the visible page size", async () => {
    render(await loadPage({ q: "Ana & Silva", clicked: "1", page: "2", pageSize: "50", period: "all" }));
    const href = screen.getByRole("link", { name: "Exportar CSV" }).getAttribute("href");
    const url = new URL(href!, "http://localhost");

    expect(url.pathname).toBe("/api/webinars/webinar-1/leads/export");
    expect(Object.fromEntries(url.searchParams)).toEqual({ period: "all", q: "Ana & Silva", clicked: "1" });
    expect(url.searchParams.has("page")).toBe(false);
    expect(url.searchParams.has("pageSize")).toBe(false);
  });

  it("shows the empty state without fetching rows when no leads match", async () => {
    mocks.count.mockResolvedValue(0);
    mocks.findLeads.mockResolvedValue([]);
    render(await loadPage({ page: "3", period: "all" }));

    expect(screen.getByText("Nenhum lead encontrado para os filtros selecionados.")).toBeInTheDocument();
    expect(mocks.findLeads).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent(/NaN|Infinity/);
  });

  it("does not query leads for an unauthenticated request", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(loadPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.findWebinar).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findLeads).not.toHaveBeenCalled();
  });

  it.each([null, { id: "webinar-1", ownerId: "another-owner", title: "Private", name: "Private" }])(
    "does not query leads for a missing or unowned webinar",
    async (webinar) => {
      mocks.findWebinar.mockResolvedValue(webinar);

      await expect(loadPage()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.count).not.toHaveBeenCalled();
      expect(mocks.findLeads).not.toHaveBeenCalled();
    }
  );
});
