import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  apiFailureSchema,
  leaguePreviewResponseSchema,
  linkLeagueRequestSchema,
  playerListQuerySchema,
  playersResponseSchema,
} from "@/contracts";

const componentFiles = [
  "src/components/app-shell/app-shell.tsx",
  "src/components/auth/auth-forms.tsx",
  "src/components/auth/invite-form.tsx",
  "src/components/leagues/league-link-onboarding.tsx",
  "src/components/players/player-browser.tsx",
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

  it("renders dark theme on the initial document paint", () => {
    const rootLayout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    const providers = readFileSync(join(process.cwd(), "src/components/providers.tsx"), "utf8");

    expect(rootLayout).toContain('className="dark"');
    expect(providers).toContain('defaultTheme="dark"');
    expect(providers).toContain("enableSystem={false}");
  });

  it("normalizes player list pagination and sorting", () => {
    expect(
      playerListQuerySchema.parse({
        page: "2",
        pageSize: "10",
        sort: "production",
        dir: "desc",
        rostered: "true",
        fantasyRelevant: "true",
        injured: "true",
        ageMin: "23",
        ageMax: "29",
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      sort: "production",
      dir: "desc",
      rostered: true,
      fantasyRelevant: true,
      injured: true,
      ageMin: 23,
      ageMax: 29,
    });
  });

  it("defines player browser cards with production and roster context", () => {
    const parsed = playersResponseSchema.parse({
      ok: true,
      data: {
        items: [
          {
            sleeperPlayerId: "4046",
            fullName: "Patrick Mahomes",
            firstName: "Patrick",
            lastName: "Mahomes",
            position: "QB",
            team: "KC",
            status: "Active",
            age: 29,
            fantasyPositions: ["QB"],
            rosterExposure: {
              rosteredCount: 1,
              leagueCount: 1,
              labels: ["BusyGiraffe"],
            },
            seasonSummary: {
              season: 2025,
              games: 17,
              fantasyPointsPpr: 355.4,
              fantasyPointsPerGame: 20.9,
              keyStats: {
                passingYards: 3928,
                passingTds: 26,
                rushingYards: 307,
                rushingTds: 2,
                receptions: null,
                receivingYards: null,
                receivingTds: null,
              },
            },
            trend: [
              { week: 15, fantasyPointsPpr: 18.2 },
              { week: 16, fantasyPointsPpr: 24.1 },
            ],
            badges: ["rostered"],
            sourceUpdatedAt: "2026-05-30T01:00:00.000Z",
            updatedAt: "2026-05-30T01:00:00.000Z",
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
      },
      meta: { requestId: "request-id" },
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.items[0]?.seasonSummary?.fantasyPointsPerGame : null).toBe(20.9);
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
