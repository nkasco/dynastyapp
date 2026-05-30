import { describe, expect, it } from "vitest";

import { updateLeagueSettingsRequestSchema } from "@/contracts/leagues";
import { pprScoringFromSettings } from "@/server/leagues/service";

describe("league PPR scoring", () => {
  it("derives standard, half, and full PPR from Sleeper reception scoring", () => {
    expect(pprScoringFromSettings({ rec: 0 })).toMatchObject({
      value: 0,
      label: "Standard",
      source: "sleeper",
      canSetProfilePreference: false,
    });
    expect(pprScoringFromSettings({ rec: "0.5" })).toMatchObject({
      value: 0.5,
      label: "Half PPR",
      source: "sleeper",
      canSetProfilePreference: false,
    });
    expect(pprScoringFromSettings({ rec: 1 })).toMatchObject({
      value: 1,
      label: "Full PPR",
      source: "sleeper",
      canSetProfilePreference: false,
    });
  });

  it("falls back to the linked user's league preference when Sleeper scoring is missing", () => {
    expect(pprScoringFromSettings({}, 0.5)).toMatchObject({
      value: 0.5,
      label: "Half PPR",
      source: "profile",
      canSetProfilePreference: true,
    });
  });

  it("keeps unsupported profile values out of the API contract", () => {
    expect(updateLeagueSettingsRequestSchema.safeParse({ pprScoringPreference: 1 }).success).toBe(true);
    expect(updateLeagueSettingsRequestSchema.safeParse({ pprScoringPreference: 0.25 }).success).toBe(false);
  });
});
