import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { env } from "@/env";
import * as schema from "@/server/db/schema";

function ensureFileDatabaseDirectory(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return;
  }

  const filePath = databaseUrl.replace(/^file:/, "");
  mkdirSync(dirname(resolve(process.cwd(), filePath)), { recursive: true });
}

ensureFileDatabaseDirectory(env.DATABASE_URL);

export const client = createClient({
  url: env.DATABASE_URL,
});

export const db = drizzle(client, { schema });
export { schema };
