// Validator access for the public beta: approve/reject and the pending queue require ADMIN_TOKEN (server env),
// sent by the /verify page as the x-admin-token header. Unset token = nobody is admin (fail closed).
import { timingSafeEqual } from "node:crypto";

export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN ?? "";
  const got = req.headers.get("x-admin-token") ?? "";
  if (expected.length < 16 || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
