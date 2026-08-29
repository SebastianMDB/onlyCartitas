import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import { ApiError } from "../http.js";
import {
  confirmPasswordReset,
  createPasswordResetToken,
  listUsers,
  loginUser,
  registerUser,
  updateUser,
  updateUserProfile
} from "../repositories/users.js";
import { requireAdmin, requireAuthenticatedUser } from "../security/auth.js";
import { assertRateLimit } from "../security/rate-limit.js";
import { createSessionToken, verifySessionToken } from "../security/tokens.js";
import { buildPasswordResetEmail, sendEmail } from "../services/email.js";

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(120)
});

const registerSchema = credentialsSchema.extend({
  email: z.string().trim().email().max(160)
});

const passwordResetRequestSchema = z.object({
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(160)
});

const passwordResetConfirmSchema = z.object({
  token: z.string().trim().min(32).max(220),
  password: z.string().min(8).max(120)
});

const authRateLimit = {
  limit: 10,
  windowMs: 15 * 60 * 1000
};

const sensitiveAuthRateLimit = {
  limit: 5,
  windowMs: 15 * 60 * 1000
};

const authSubject = (value: string) => value.trim().toLowerCase();

const userUpdateSchema = z.object({
  username: z.string().trim().min(3).max(40).optional(),
  email: z.string().trim().email().max(160).nullable().optional(),
  role: z.enum(["admin", "customer"]).optional()
});

const profileUpdateSchema = z
  .object({
    username: z.string().trim().min(3).max(40).optional(),
    email: z.string().trim().email().max(160).optional(),
    currentPassword: z.string().min(8).max(120),
    password: z.string().min(8).max(120).optional()
  })
  .refine((input) => Boolean(input.username || input.email || input.password), {
    message: "No hay cambios para guardar",
    path: ["username"]
  });

const publicUser = (user: NonNullable<Awaited<ReturnType<typeof loginUser>>>) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role
});

const createAuthResponse = (user: Awaited<ReturnType<typeof loginUser>>) => {
  if (!user) throw new ApiError(401, "Credenciales invalidas");
  const token = createSessionToken(user);
  const session = verifySessionToken(token);

  return {
    user: publicUser(user),
    token,
    expiresAt: session?.expiresAt ?? Date.now()
  };
};

export async function authRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    reply.header("Pragma", "no-cache");
  });

  app.post("/api/auth/register", async (request) => {
    if (!env.AUTH_REGISTER_ENABLED) throw new ApiError(403, "Registro deshabilitado");
    assertRateLimit({
      key: `register:${request.ip}`,
      ...authRateLimit
    });

    const input = registerSchema.parse(request.body);
    const user = await registerUser(input.username, input.email, input.password);

    return createAuthResponse(user);
  });

  app.post("/api/auth/login", async (request) => {
    assertRateLimit({
      key: `login:${request.ip}`,
      ...authRateLimit
    });

    const input = credentialsSchema.parse(request.body);
    assertRateLimit({
      key: `login-user:${authSubject(input.username)}`,
      ...sensitiveAuthRateLimit
    });
    const user = await loginUser(input.username, input.password);

    return createAuthResponse(user);
  });

  app.post("/api/auth/reset-password/request", async (request) => {
    assertRateLimit({
      key: `reset-password:${request.ip}`,
      ...authRateLimit
    });

    const input = passwordResetRequestSchema.parse(request.body);
    assertRateLimit({
      key: `reset-password-user:${authSubject(input.username)}`,
      ...sensitiveAuthRateLimit
    });
    assertRateLimit({
      key: `reset-password-email:${authSubject(input.email)}`,
      ...sensitiveAuthRateLimit
    });
    const reset = await createPasswordResetToken(input.username, input.email);
    if (reset) {
      const resetUrl = `${env.WEB_ORIGIN}/login?resetToken=${encodeURIComponent(reset.token)}`;
      await sendEmail(buildPasswordResetEmail(reset.email, resetUrl));
    }

    return {
      ok: true,
      message: "Si los datos coinciden, enviaremos un link de recuperacion al correo registrado."
    };
  });

  app.post("/api/auth/reset-password/confirm", async (request) => {
    assertRateLimit({
      key: `reset-password-confirm:${request.ip}`,
      ...authRateLimit
    });

    const input = passwordResetConfirmSchema.parse(request.body);
    await confirmPasswordReset(input.token, input.password);

    return {
      ok: true
    };
  });

  app.get("/api/auth/me", async (request) => {
    const session = verifySessionToken(request.headers.authorization);
    const user = await requireAuthenticatedUser(request.headers.authorization);
    const token = createSessionToken(user, session?.expiresAt);
    const refreshedSession = verifySessionToken(token);

    return {
      user: publicUser(user),
      token,
      expiresAt: refreshedSession?.expiresAt ?? session?.expiresAt ?? Date.now()
    };
  });

  app.patch("/api/auth/me", async (request) => {
    const session = verifySessionToken(request.headers.authorization);
    const currentUser = await requireAuthenticatedUser(request.headers.authorization);
    const input = profileUpdateSchema.parse(request.body);
    const user = await updateUserProfile(currentUser.id, input);
    if (!user) throw new ApiError(404, "Usuario no encontrado");

    const token = createSessionToken(user, session?.expiresAt);
    const refreshedSession = verifySessionToken(token);

    return {
      user: publicUser(user),
      token,
      expiresAt: refreshedSession?.expiresAt ?? session?.expiresAt ?? Date.now()
    };
  });

  app.get("/api/admin/users", async (request) => {
    await requireAdmin(request.headers.authorization);

    return {
      data: await listUsers()
    };
  });

  app.patch("/api/admin/users/:id", async (request) => {
    const session = await requireAdmin(request.headers.authorization);
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
