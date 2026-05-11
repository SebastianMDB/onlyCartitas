import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { appUsers } from "../db/schema.js";
import { ApiError } from "../http.js";
import { hashPassword, verifyPassword } from "../security/passwords.js";
import type { AuthUser } from "../types.js";

type StoredUser = AuthUser & {
  password_hash: string;
};

const localUsers: StoredUser[] = [
  {
    id: "local-admin",
    username: "admin",
    role: "admin",
    password_hash: hashPassword("admin1234")
  }
];

export async function registerUser(username: string, password: string) {
  if (!db) {
    if (localUsers.some((user) => user.username === username)) {
      throw new ApiError(409, "El usuario ya existe");
    }

    const user: StoredUser = {
      id: randomUUID(),
      username,
      role: "customer",
      password_hash: hashPassword(password)
    };

    localUsers.push(user);
    return publicUser(user);
  }

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
  if (!db) {
    const user = localUsers.find((item) => item.username === username);
    if (!user || !verifyPassword(password, user.password_hash)) return null;
    return publicUser(user);
  }

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

const publicUser = (user: StoredUser): AuthUser => ({
  id: user.id,
  username: user.username,
  role: user.role
});
