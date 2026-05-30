import { describe, expect, it } from "vitest";

import { playerSearchTerms } from "@/server/players/service";

describe("player search normalization", () => {
  it("matches spaced first-last searches against compact Sleeper search names", () => {
    expect(playerSearchTerms("Joe Burrow")).toEqual(["joe burrow", "joeburrow"]);
  });

  it("normalizes punctuation so apostrophe variants can still match", () => {
    expect(playerSearchTerms("Ja'Marr Chase")).toEqual(["ja'marr chase", "ja marr chase", "jamarrchase"]);
  });
});
