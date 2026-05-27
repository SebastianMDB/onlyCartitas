import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { appUsers } from "../db/schema.js";
import { ApiError } from "../http.js";
import { hashPassword, verifyPassword } from "../security/passwords.js";
import type { AuthUser } from "../types.js";

type UserUpdateInput = {
  username?: string;
  role?: "admin" | "customer";
};

export async function registerUser(username: string, password: string) {
  try {
    const [existing] = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(eq(appUsers.username, username))
      .limit(1);

    if (existing) throw new ApiError(409, "El usuario ya existe");

    const [user] = await db
      .insert(appUsers)
      .values({
        username,
        role: "customer",
        passwordHash: hashPassword(password)
      })
      .returning({
        id: appUsers.id,
        username: appUsers.username,
        role: appUsers.role
      });

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
      role: user.role
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
        role: appUsers.role,
        createdAt: appUsers.createdAt,
        updatedAt: appUsers.updatedAt
      })
      .from(appUsers);
  } catch {
    throw new ApiError(500, "No se pudieron obtener los usuarios");
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
