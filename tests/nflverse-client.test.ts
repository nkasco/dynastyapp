import { describe, expect, it, vi } from "vitest";

import { deriveSeasonSummaries, NflverseClient } from "@/server/nflverse/service";

function csvResponse(body: string) {
  return new Response(body, { status: 200, headers: { "content-type": "text/csv" } });
}

describe("nflverse client", () => {
  it("loads player ID bridge rows from nflverse CSV", async () => {
    const fetcher = vi.fn(async () =>
      csvResponse("gsis_id,sleeper_id,display_name,position\n00-0033873,4046,Patrick Mahomes,QB\n"),
    );
    const client = new NflverseClient({ baseUrl: "https://example.test/releases", fetcher });

    await expect(client.getPlayerIds()).resolves.toEqual([
      expect.objectContaining({
        gsis_id: "00-0033873",
        sleeper_id: "4046",
        display_name: "Patrick Mahomes",
      }),
    ]);
    expect(fetcher).toHaveBeenCalledWith("https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv");
  });

  it("loads weekly stat rows and preserves quoted CSV fields", async () => {
    const fetcher = vi.fn(async () =>
      csvResponse(
        'player_id,player_display_name,season,week,season_type,recent_team,opponent_team,position,fantasy_points,fantasy_points_ppr\n00-0033873,"Mahomes, Patrick",2025,1,REG,KC,LAC,QB,25.4,25.4\n',
      ),
    );
    const client = new NflverseClient({ baseUrl: "https://example.test/releases", fetcher });

    await expect(client.getWeeklyStats()).resolves.toEqual([
      expect.objectContaining({
        player_id: "00-0033873",
        player_display_name: "Mahomes, Patrick",
        season: 2025,
        week: 1,
        fantasy_points_ppr: 25.4,
      }),
    ]);
    expect(fetcher).toHaveBeenCalledWith("https://example.test/releases/player_stats/player_stats.csv");
  });
});

describe("nflverse season summaries", () => {
  it("derives season totals from weekly stat rows", () => {
    const summaries = deriveSeasonSummaries([
      {
        id: "w1",
        sleeperPlayerId: "4046",
        gsisId: "00-0033873",
        playerName: "Patrick Mahomes",
        season: 2025,
        week: 1,
        seasonType: "REG",
        team: "KC",
        opponent: "LAC",
        position: "QB",
        stats: { passing_yards: 300, passing_tds: 3, player_id: "00-0033873" },
        fantasyPointsPpr: 25.4,
        fantasyPointsHalfPpr: 25.4,
        fantasyPointsStandard: 25.4,
      },
      {
        id: "w2",
        sleeperPlayerId: "4046",
        gsisId: "00-0033873",
        playerName: "Patrick Mahomes",
        season: 2025,
        week: 2,
        seasonType: "REG",
        team: "KC",
        opponent: "PHI",
        position: "QB",
        stats: { passing_yards: 250, passing_tds: 2 },
        fantasyPointsPpr: 20.1,
        fantasyPointsHalfPpr: 20.1,
        fantasyPointsStandard: 20.1,
      },
    ]);

    expect(summaries).toEqual([
      expect.objectContaining({
        sleeperPlayerId: "4046",
        gsisId: "00-0033873",
        season: 2025,
        games: 2,
        fantasyPointsPpr: 45.5,
        stats: expect.objectContaining({ passing_yards: 550, passing_tds: 5 }),
      }),
    ]);
  });
});
