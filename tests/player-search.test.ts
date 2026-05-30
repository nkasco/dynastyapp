import { describe, expect, it } from "vitest";

import { playerListQuerySchema } from "@/contracts/players";
import { draftInfoFromMetadata, playerSearchTerms } from "@/server/players/service";

describe("player search normalization", () => {
  it("matches spaced first-last searches against compact Sleeper search names", () => {
    expect(playerSearchTerms("Joe Burrow")).toEqual(["joe burrow", "joeburrow"]);
  });

  it("normalizes punctuation so apostrophe variants can still match", () => {
    expect(playerSearchTerms("Ja'Marr Chase")).toEqual(["ja'marr chase", "ja marr chase", "jamarrchase"]);
  });

  it("accepts roster and season filters from player query params", () => {
    const parsed = playerListQuerySchema.parse({
      page: "1",
      pageSize: "36",
      leagueId: "league-1",
      rosterId: "7",
      season: "2024",
    });

    expect(parsed.rosterId).toBe(7);
    expect(parsed.season).toBe(2024);
  });

  it("maps NFL draft metadata from the player ID bridge", () => {
    expect(draftInfoFromMetadata({ draft_year: "2024", draft_round: "1", draft_pick: "6" })).toEqual({
      year: 2024,
      round: 1,
      pick: 6,
    });
    expect(draftInfoFromMetadata({ draft_year: "2024" })).toBeNull();
  });
});
