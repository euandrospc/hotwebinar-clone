import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const AB_VISITOR_COOKIE = "hw_ab_visitor";
export function abAssignmentCookieName(webinarId: string) {
  return `hw_ab_${createHash("sha256").update(webinarId).digest("hex").slice(0, 20)}`;
}
function signature(scope: string, value: string) {
  const secret = process.env.LEAD_SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("Missing or too-short env: LEAD_SESSION_SECRET");
  return createHmac("sha256", secret).update(`ab-v1:${scope}:${value}`).digest("hex");
}
function sign(scope: string, value: string) { return `${value}.${signature(scope, value)}`; }
function verify(scope: string, token: string | null | undefined) {
  if (!token || token.length > 256) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[a-zA-Z0-9_-]{1,128}$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) return null;
  const expected = Buffer.from(signature(scope, parts[0]), "hex"), actual = Buffer.from(parts[1], "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? parts[0] : null;
}
export const signAbVisitor = (visitorId: string) => sign("visitor", visitorId);
export const verifyAbVisitor = (token: string | null | undefined) => verify("visitor", token);
export const signAbAssignment = (assignmentId: string) => sign("assignment", assignmentId);
export const verifyAbAssignment = (token: string | null | undefined) => verify("assignment", token);
