import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isSharedImportJob } from "@/server/imports/service";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("data ownership boundaries", () => {
  it("documents nflverse as global data and Sleeper league context as user-scoped", () => {
    const spec = source("spec.md");

    expect(spec).toContain("nflverse data is shared across all users");
    expect(spec).toContain("Sleeper league and roster context is scoped to the user profiles that linked it");
  });

  it("passes authenticated user identity into league and player reads", () => {
    expect(source("app/api/leagues/route.ts")).toContain("listLeagues(query, user.id)");
    expect(source("app/api/leagues/[id]/route.ts")).toContain("getLeagueById(id, user.id)");
    expect(source("app/api/leagues/[id]/route.ts")).toContain("deleteLeagueById(id, user.id)");
    expect(source("app/api/players/route.ts")).toContain("listPlayers(query, user.id)");
    expect(source("app/api/players/[id]/route.ts")).toContain("getPlayerById(id, user.id)");
  });

  it("scopes Sleeper league reads and player roster exposure through linked user teams", () => {
    const leagues = source("src/server/leagues/service.ts");
    const players = source("src/server/players/service.ts");

    expect(leagues).toContain("userLeagueTeams");
    expect(leagues).toContain("eq(userLeagueTeams.userId, userId)");
    expect(leagues).toContain("deleteLeagueById");
    expect(players).toContain("userLeagueTeams");
    expect(players).toContain("eq(userLeagueTeams.userId, userId)");
  });

  it("records a user owner for user-started Sleeper import jobs while nflverse remains global", () => {
    const schema = source("src/server/db/schema.ts");
    const importsService = source("src/server/imports/service.ts");
    const sleeperImportRoute = source("app/api/imports/sleeper/route.ts");
    const nflverseImportRoute = source("app/api/imports/nflverse/route.ts");

    expect(schema).toContain('userId: text("user_id")');
    expect(sleeperImportRoute).toContain("queueSleeperImport(input, user.id)");
    expect(importsService).toContain("userId");
    expect(nflverseImportRoute).toContain("queueNflverseImport(input)");
  });

  it("treats nflverse and non-league shared jobs as global, but not Sleeper league jobs", () => {
    expect(isSharedImportJob({ source: "nflverse", scope: "full", leagueId: null, userId: null })).toBe(true);
    expect(isSharedImportJob({ source: "system", scope: "nightly-refresh", leagueId: null, userId: null })).toBe(true);
    expect(isSharedImportJob({ source: "sleeper", scope: "players", leagueId: null, userId: null })).toBe(true);
    expect(isSharedImportJob({ source: "sleeper", scope: "league", leagueId: "league-1", userId: null })).toBe(false);
    expect(isSharedImportJob({ source: "sleeper", scope: "league-link", leagueId: "league-1", userId: "user-1" })).toBe(
      false,
    );
  });

  it("requires linked Sleeper leagues before queueing Sleeper league imports", () => {
    const importsService = source("src/server/imports/service.ts");

    expect(importsService).toContain("requireLinkedSleeperLeague");
    expect(importsService).toContain("Link this Sleeper league to your profile before importing its league data.");
    expect(importsService).toContain("eq(userLeagueTeams.userId, userId)");
  });
});
