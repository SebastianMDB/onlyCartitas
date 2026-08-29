import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { appUsers, passwordResetTokens } from "../db/schema.js";
import { env } from "../env.js";
import { ApiError } from "../http.js";
import { hashPassword, verifyPassword } from "../security/passwords.js";
import type { AuthUser } from "../types.js";

type UserUpdateInput = {
  username?: string;
  email?: string | null;
  role?: "admin" | "customer";
};

type UserProfileUpdateInput = {
  username?: string;
  email?: string;
  currentPassword?: string;
  password?: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

const userReturnFields = {
  id: appUsers.id,
  username: appUsers.username,
  email: appUsers.email,
  role: appUsers.role,
  sessionVersion: appUsers.sessionVersion
};

export async function registerUser(username: string, email: string, password: string) {
  try {
    const normalizedEmail = normalizeEmail(email);
    const [existing] = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(eq(appUsers.username, username))
      .limit(1);

    if (existing) throw new ApiError(409, "El usuario ya existe");

    const [existingEmail] = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(eq(appUsers.email, normalizedEmail))
      .limit(1);

    if (existingEmail) throw new ApiError(409, "El correo ya esta registrado");

    const [user] = await db
      .insert(appUsers)
      .values({
        username,
        email: normalizedEmail,
        role: "customer",
        passwordHash: hashPassword(password)
      })
      .returning(userReturnFields);

    return user as AuthUser;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "No se pudo crear el usuario");
  }
}

export async function loginUser(username: string, password: string) {
  try {
    const [user] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.username, username))
      .limit(1);

    if (!user || !verifyPassword(password, user.passwordHash)) return null;

    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        sessionVersion: user.sessionVersion
      };
  } catch {
    throw new ApiError(500, "No se pudo iniciar sesion");
  }
}

export async function listUsers() {
  try {
    return await db
      .select({
        id: appUsers.id,
        username: appUsers.username,
        email: appUsers.email,
        role: appUsers.role,
        createdAt: appUsers.createdAt,
        updatedAt: appUsers.updatedAt
      })
      .from(appUsers);
  } catch {
    throw new ApiError(500, "No se pudieron obtener los usuarios");
  }
}

export async function getUserById(id: string) {
  try {
    const [user] = await db.select(userReturnFields).from(appUsers).where(eq(appUsers.id, id)).limit(1);
    return (user as AuthUser | undefined) ?? null;
  } catch {
    throw new ApiError(500, "No se pudo obtener el usuario");
  }
}

export async function updateUser(id: string, input: UserUpdateInput) {
  try {
    if (input.username) {
      const [existing] = await db
        .select({ id: appUsers.id })
        .from(appUsers)
        .where(eq(appUsers.username, input.username))
        .limit(1);

      if (existing && existing.id !== id) throw new ApiError(409, "El usuario ya existe");
    }

    if (input.email !== undefined && input.email !== null) {
      input.email = normalizeEmail(input.email);
      const [existing] = await db
        .select({ id: appUsers.id })
        .from(appUsers)
        .where(eq(appUsers.email, input.email))
        .limit(1);

      if (existing && existing.id !== id) throw new ApiError(409, "El correo ya esta registrado");
    }

    const [user] = await db
      .update(appUsers)
      .set({
        ...input,
        updatedAt: new Date()
      })
      .where(eq(appUsers.id, id))
      .returning({
        id: appUsers.id,
        username: appUsers.username,
        email: appUsers.email,
        role: appUsers.role,
        createdAt: appUsers.createdAt,
        updatedAt: appUsers.updatedAt
      });

    return user ?? null;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "No se pudo actualizar el usuario");
  }
}

export async function updateUserProfile(id: string, input: UserProfileUpdateInput) {
  try {
    const [currentUser] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
    if (!currentUser) return null;
    if (!input.currentPassword || !verifyPassword(input.currentPassword, currentUser.passwordHash)) {
      throw new ApiError(400, "La clave actual no coincide");
    }

    const updates: Partial<typeof appUsers.$inferInsert> = {
      updatedAt: new Date()
    };

    if (input.username && input.username !== currentUser.username) {
      const [existing] = await db
        .select({ id: appUsers.id })
        .from(appUsers)
        .where(eq(appUsers.username, input.username))
        .limit(1);

      if (existing && existing.id !== id) throw new ApiError(409, "El usuario ya existe");
      updates.username = input.username;
    }

    if (input.email !== undefined) {
      const email = normalizeEmail(input.email);
      if (email !== currentUser.email) {
        const [existing] = await db
          .select({ id: appUsers.id })
          .from(appUsers)
          .where(eq(appUsers.email, email))
          .limit(1);

        if (existing && existing.id !== id) throw new ApiError(409, "El correo ya esta registrado");
        updates.email = email;
      }
    }

    if (input.password) {
      updates.passwordHash = hashPassword(input.password);
      updates.sessionVersion = currentUser.sessionVersion + 1;
    }

    const [user] = await db.update(appUsers).set(updates).where(eq(appUsers.id, id)).returning(userReturnFields);

    return (user as AuthUser | undefined) ?? null;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "No se pudo actualizar el perfil");
  }
}

export async function createPasswordResetToken(username: string, email: string) {
  try {
    const normalizedEmail = normalizeEmail(email);
    const [user] = await db
      .select({
        id: appUsers.id,
        email: appUsers.email
      })
      .from(appUsers)
      .where(eq(appUsers.username, username))
      .limit(1);

    if (!user?.email || user.email.toLowerCase() !== normalizedEmail) {
      return null;
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt
      });
    });

    return {
      email: normalizedEmail,
      token,
      expiresAt
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "No se pudo preparar el restablecimiento de clave");
  }
}

export async function confirmPasswordReset(token: string, password: string) {
  try {
    const [resetToken] = await db
      .select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId
      })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hashResetToken(token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!resetToken) throw new ApiError(400, "El link expiro o ya fue usado");

    await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ sessionVersion: appUsers.sessionVersion })
        .from(appUsers)
        .where(eq(appUsers.id, resetToken.userId))
        .limit(1);

      if (!user) throw new ApiError(400, "El link expiro o ya fue usado");

      await tx
        .update(appUsers)
        .set({
          passwordHash: hashPassword(password),
          sessionVersion: user.sessionVersion + 1,
          updatedAt: new Date()
        })
        .where(eq(appUsers.id, resetToken.userId));

      await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetToken.id));
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "No se pudo restablecer la clave");
  }
}
