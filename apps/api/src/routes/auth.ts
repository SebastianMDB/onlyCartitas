import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import { ApiError } from "../http.js";
import { listUsers, loginUser, registerUser, updateUser } from "../repositories/users.js";
import { assertRateLimit } from "../security/rate-limit.js";
import { createSessionToken, verifySessionToken } from "../security/tokens.js";

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(120)
});

const authRateLimit = {
  limit: 10,
  windowMs: 15 * 60 * 1000
};

const userUpdateSchema = z.object({
  username: z.string().trim().min(3).max(40).optional(),
  role: z.enum(["admin", "customer"]).optional()
});

const requireAdmin = (authorization: string | undefined) => {
  const session = verifySessionToken(authorization);
  if (session?.role !== "admin") throw new ApiError(403, "Permisos insuficientes");
  return session;
};

const createAuthResponse = (user: Awaited<ReturnType<typeof loginUser>>) => {
  if (!user) throw new ApiError(401, "Credenciales invalidas");
  const token = createSessionToken(user);
  const session = verifySessionToken(token);

  return {
    user,
    token,
    expiresAt: session?.expiresAt ?? Date.now()
  };
};

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request) => {
    if (!env.AUTH_REGISTER_ENABLED) throw new ApiError(403, "Registro deshabilitado");
    assertRateLimit({
      key: `register:${request.ip}`,
      ...authRateLimit
    });

    const input = credentialsSchema.parse(request.body);
    const user = await registerUser(input.username, input.password);

    return createAuthResponse(user);
  });

  app.post("/api/auth/login", async (request) => {
    assertRateLimit({
      key: `login:${request.ip}`,
      ...authRateLimit
    });

    const input = credentialsSchema.parse(request.body);
    const user = await loginUser(input.username, input.password);

    return createAuthResponse(user);
  });

  app.get("/api/auth/me", async (request) => {
    const session = verifySessionToken(request.headers.authorization);
    if (!session) throw new ApiError(401, "Sesion invalida");

    return {
      user: {
        id: session.id,
        username: session.username,
        role: session.role
      },
      expiresAt: session.expiresAt
    };
  });

  app.get("/api/admin/users", async (request) => {
    requireAdmin(request.headers.authorization);

    return {
      data: await listUsers()
    };
  });

  app.patch("/api/admin/users/:id", async (request) => {
    const session = requireAdmin(request.headers.authorization);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const input = userUpdateSchema.parse(request.body);
    if (id === session.id && input.role && input.role !== "admin") {
      throw new ApiError(400, "No puedes quitarte tu propio rol admin");
    }

    const user = await updateUser(id, input);
    if (!user) throw new ApiError(404, "Usuario no encontrado");

    return {
      data: user
    };
  });
}
