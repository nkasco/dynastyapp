import "server-only";

import { db } from "@/server/db/client";

export function getDatabase() {
  return db;
}
