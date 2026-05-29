import { describe, expect, it } from "vitest";

import { envSchema } from "@/env";

describe("envSchema", () => {
  it("provides local development defaults", () => {
    const parsed = envSchema.parse({});

    expect(parsed.DATABASE_URL).toBe("file:./data/dynalytics.db");
    expect(parsed.IMPORT_TIME_ZONE).toBe("America/New_York");
    expect(parsed.LOCAL_AUTH_ENABLED).toBe(true);
  });

  it("requires auth secret in production", () => {
    const parsed = envSchema.safeParse({ NODE_ENV: "production" });

    expect(parsed.success).toBe(false);
  });
});
