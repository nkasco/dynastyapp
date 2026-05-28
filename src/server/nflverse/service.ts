import "server-only";

import { env } from "@/env";

export function getNflverseServiceStatus() {
  return {
    source: "nflverse" as const,
    baseUrl: env.NFLVERSE_BASE_URL,
    mode: "read-only" as const,
  };
}
