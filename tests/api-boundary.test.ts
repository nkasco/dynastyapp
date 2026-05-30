import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { apiFailureSchema, leaguePreviewResponseSchema, linkLeagueRequestSchema, playerListQuerySchema } from "@/contracts";

const componentFiles = [
  "src/components/app-shell/app-shell.tsx",
  "src/components/auth/auth-forms.tsx",
  "src/components/auth/invite-form.tsx",
  "src/components/leagues/league-link-onboarding.tsx",
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

  it("requires roster selection when linking a league", () => {
    expect(linkLeagueRequestSchema.parse({ sleeperLeagueId: "123", rosterId: 7 })).toEqual({
      sleeperLeagueId: "123",
      rosterId: 7,
    });
    expect(() => linkLeagueRequestSchema.parse({ sleeperLeagueId: "123" })).toThrow();
  });

  it("defines a typed league preview response", () => {
    const parsed = leaguePreviewResponseSchema.parse({
        ok: true,
        data: {
          sleeperLeagueId: "123",
          name: "Home League",
          season: 2026,
          status: "in_season",
          rosterCount: 2,
          userCount: 2,
          rosters: [
            {
              rosterId: 1,
              ownerSleeperUserId: "u1",
              ownerName: "Nate",
              playerCount: 22,
              starterCount: 10,
            },
          ],
        },
        meta: { requestId: "request-id" },
      });

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.rosters[0]?.ownerName : null).toBe("Nate");
  });
});
