export const ATTENDANT_ROLES = ["attendant", "admin"];
export const ADMIN_ROLES = ["admin"];

export function hasRole(role: string | undefined | null, allowed: string[]): boolean {
  return typeof role === "string" && allowed.includes(role);
}
