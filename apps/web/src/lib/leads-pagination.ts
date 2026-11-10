export const LEADS_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_LEADS_PAGE_SIZE = LEADS_PAGE_SIZES[0];

type QueryValue = string | string[] | undefined;

export function parseLeadsPagination(params: { page?: QueryValue; pageSize?: QueryValue }) {
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const rawSize = Array.isArray(params.pageSize) ? params.pageSize[0] : params.pageSize;
  const requestedPage = rawPage && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(requestedPage) ? requestedPage : 1;
  const pageSize = LEADS_PAGE_SIZES.find((size) => String(size) === rawSize) ?? DEFAULT_LEADS_PAGE_SIZE;
  return { page, pageSize };
}

export function getLeadsPage(requestedPage: number, total: number, pageSize: number) {
  return Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
}

export function leadsPageHref(baseHref: string, filters: Record<string, string>, page: number, pageSize: number) {
  return `${baseHref}?${new URLSearchParams({ ...filters, page: String(page), pageSize: String(pageSize) })}`;
}

/** Keep a small, constant number of controls even with thousands of pages. */
export function leadsPageNumbers(page: number, totalPages: number): (number | "ellipsis")[] {
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  return pages.flatMap((value, index) => index > 0 && value - pages[index - 1] > 1
    ? ["ellipsis" as const, value]
    : [value]);
}
