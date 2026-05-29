import { describe, expect, it } from "vitest";

import { importLockKey, isTemporaryImportError } from "@/server/imports/runner";

describe("import runner", () => {
  it("builds stable lock keys from an import identity", () => {
    expect(
      importLockKey({
        source: "sleeper",
        scope: "league",
        leagueId: "league-1",
        season: 2026,
        week: 4,
      }),
    ).toBe("import:sleeper:league:league-1:2026:4");

    expect(
      importLockKey({
        source: "nflverse",
        scope: "full",
        leagueId: null,
        season: 2026,
        week: null,
      }),
    ).toBe("import:nflverse:full:global:2026:all-weeks");
  });

  it("classifies transient source failures for retry", () => {
    expect(isTemporaryImportError(new TypeError("fetch failed"))).toBe(true);
    expect(isTemporaryImportError(new Error("HTTP 503 from source"))).toBe(true);
    expect(isTemporaryImportError(Object.assign(new Error("try later"), { temporary: true }))).toBe(true);
    expect(isTemporaryImportError(new Error("invalid payload shape"))).toBe(false);
  });
});
