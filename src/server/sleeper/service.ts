import "server-only";

import { env } from "@/env";

export function getSleeperServiceStatus() {
  return {
    source: "sleeper" as const,
    baseUrl: env.SLEEPER_BASE_URL,
    mode: "read-only" as const,
  };
}
