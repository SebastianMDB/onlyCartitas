import { ApiError } from "../http.js";
import { getUserById } from "../repositories/users.js";
import type { AuthUser } from "../types.js";
import { verifySessionToken } from "./tokens.js";

export async function getAuthenticatedUser(authorization: string | undefined): Promise<AuthUser | null> {
  const session = verifySessionToken(authorization);
  if (!session) return null;

  const user = await getUserById(session.id);
  if (!user) return null;
  if ((session.sessionVersion ?? 0) !== user.sessionVersion) return null;

  return user;
}

export async function requireAuthenticatedUser(authorization: string | undefined): Promise<AuthUser> {
  const user = await getAuthenticatedUser(authorization);
  if (!user) throw new ApiError(401, "Sesion invalida");

  return user;
}

export async function requireAdmin(authorization: string | undefined): Promise<AuthUser> {
  const user = await requireAuthenticatedUser(authorization);
  if (user.role !== "admin") throw new ApiError(403, "Permisos insuficientes");

  return user;
}
