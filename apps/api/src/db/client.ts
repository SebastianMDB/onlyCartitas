import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, hasDatabaseConfig } from "../env.js";
import * as schema from "./schema.js";

const queryClient = hasDatabaseConfig
  ? postgres(env.DATABASE_URL as string, {
      max: 5,
      prepare: false
    })
  : null;

export const db = queryClient ? drizzle(queryClient, { schema }) : null;
