import { ADMIN_ROLES, hasRole } from "./roles";

// Webinars and videos keep `ownerId` as their creator. Owners keep access to
// what they created; any user whose current role is admin can see and edit
// every webinar and video. Attendant/disabled roles gain nothing here.

export type AccessUser = { id: string; role?: string | null };
type AccessSubject = AccessUser | { user: { id: string } };
type Owned = { ownerId: string };

/** Realtime room shared by every admin dashboard socket. */
export const ADMIN_DASHBOARD_ROOM = "dashboard:admins";

export function toAccessUser(subject: AccessSubject): AccessUser {
  const user = "user" in subject ? subject.user : subject;
  return { id: user.id, role: (user as { role?: string | null }).role ?? null };
}

export function isAdminUser(subject: AccessSubject): boolean {
  return hasRole(toAccessUser(subject).role, ADMIN_ROLES);
}

/** True when the resource exists and the user created it or is an admin. */
export function canAccessOwned<T extends Owned>(subject: AccessSubject, resource: T | null | undefined): resource is T {
  if (!resource) return false;
  const user = toAccessUser(subject);
  return resource.ownerId === user.id || hasRole(user.role, ADMIN_ROLES);
}

export const canAccessWebinar = canAccessOwned;
export const canAccessVideo = canAccessOwned;

/** Prisma `where` fragment for webinars/videos the user may access. Empty for admins. */
export function ownerScope(subject: AccessSubject): { ownerId?: string } {
  const user = toAccessUser(subject);
  if (!user.id) throw new Error("Authenticated user is required");
  return hasRole(user.role, ADMIN_ROLES) ? {} : { ownerId: user.id };
}
