/** Browser-safe identity hint. It never authenticates a request without its signed cookie. */
export interface LeadRequestScope { webinarId: string; leadId: string }

export function leadScopedUrl(path: string, scope: LeadRequestScope): string {
  const query = new URLSearchParams({ webinarId: scope.webinarId, leadId: scope.leadId });
  return `${path}${path.includes("?") ? "&" : "?"}${query.toString()}`;
}
