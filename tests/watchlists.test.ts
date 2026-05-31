import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  removedWatchlistItemResponseSchema,
  watchlistItemResponseSchema,
  watchlistPlayerRequestSchema,
  watchlistResponseSchema,
} from "@/contracts/watchlists";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("watchlists", () => {
  it("validates list, add, and remove API contracts", () => {
    expect(watchlistPlayerRequestSchema.parse({ leagueId: "sleeper:123", sleeperPlayerId: "4046" })).toEqual({
      leagueId: "sleeper:123",
      sleeperPlayerId: "4046",
    });

    expect(
      watchlistResponseSchema.parse({
        ok: true,
        data: {
          leagueId: "sleeper:123",
          items: [
            {
              id: "watch-1",
              leagueId: "sleeper:123",
              sleeperPlayerId: "4046",
              fullName: "Patrick Mahomes",
              position: "QB",
              team: "KC",
              status: "Active",
              age: 30,
              createdAt: "2026-05-30T01:00:00.000Z",
            },
          ],
        },
        meta: { requestId: "request-id" },
      }).ok,
    ).toBe(true);

    expect(
      watchlistItemResponseSchema.parse({
        ok: true,
        data: {
          id: "watch-1",
          leagueId: "sleeper:123",
          sleeperPlayerId: "4046",
          fullName: "Patrick Mahomes",
          position: "QB",
          team: "KC",
          status: "Active",
          age: 30,
          createdAt: "2026-05-30T01:00:00.000Z",
        },
        meta: { requestId: "request-id" },
      }).ok,
    ).toBe(true);

    expect(
      removedWatchlistItemResponseSchema.parse({
        ok: true,
        data: { leagueId: "sleeper:123", sleeperPlayerId: "4046", removed: true },
        meta: { requestId: "request-id" },
      }).ok,
    ).toBe(true);
  });

  it("keys watchlists by user profile, league, and player", () => {
    const schema = source("src/server/db/schema.ts");

    expect(schema).toContain("playerWatchlists");
    expect(schema).toContain("player_watchlists_user_league_player_unique");
    expect(schema).toContain("table.userId");
    expect(schema).toContain("table.leagueId");
    expect(schema).toContain("table.sleeperPlayerId");
  });

  it("keeps watchlist service scoped to linked user leagues", () => {
    const service = source("src/server/players/watchlist-service.ts");

    expect(service).toContain("requireLinkedLeague");
    expect(service).toContain("userLeagueTeams");
    expect(service).toContain("eq(userLeagueTeams.userId, userId)");
    expect(service).toContain("eq(playerWatchlists.userId, userId)");
    expect(service).toContain("onConflictDoNothing");
  });

  it("exposes authenticated route handlers and typed client methods", () => {
    const route = source("app/api/watchlists/route.ts");
    const client = source("src/lib/api/client.ts");

    expect(route).toContain("requireApiUser");
    expect(route).toContain("watchlistQuerySchema.parse");
    expect(route).toContain("watchlistPlayerRequestSchema.parse");
    expect(route).toContain("listWatchlist(query, user.id)");
    expect(route).toContain("addWatchlistPlayer(input, user.id)");
    expect(route).toContain("removeWatchlistPlayer(input, user.id)");
    expect(client).toContain("watchlist: (leagueId: string)");
    expect(client).toContain("addWatchlistPlayer");
    expect(client).toContain("removeWatchlistPlayer");
  });
});
