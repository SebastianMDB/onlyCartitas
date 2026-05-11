import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import { ApiError } from "../http.js";
import { loginUser, registerUser } from "../repositories/users.js";
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
}
