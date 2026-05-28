import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { apiFailureSchema, playerListQuerySchema } from "@/contracts";

const componentFiles = [
  "src/components/app-shell/app-shell.tsx",
  "src/components/auth/auth-forms.tsx",
  "src/components/auth/invite-form.tsx",
  "src/components/providers.tsx",
];

describe("API boundary", () => {
  it("keeps shared UI components away from server-only modules", () => {
    const forbidden = /@\/server|@\/auth|server-only/;

    for (const file of componentFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(forbidden);
    }
  });

  it("normalizes player list pagination and sorting", () => {
    expect(playerListQuerySchema.parse({ page: "2", pageSize: "10", sort: "age", dir: "desc" })).toEqual({
      page: 2,
      pageSize: 10,
      sort: "age",
      dir: "desc",
    });
  });

  it("defines a consistent API error envelope", () => {
    expect(
      apiFailureSchema.parse({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Sign in to use this API." },
        meta: { requestId: "request-id" },
      }),
    ).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Sign in to use this API." },
      meta: { requestId: "request-id" },
    });
  });
});
