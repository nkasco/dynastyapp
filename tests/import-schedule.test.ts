import { describe, expect, it } from "vitest";

import { getNextNightlyRunAt, parseDailyCron } from "@/server/imports/schedule";

describe("import schedule", () => {
  it("parses the daily nightly cron shape", () => {
    expect(parseDailyCron("0 1 * * *")).toEqual({ minute: 0, hour: 1 });
    expect(() => parseDailyCron("*/5 * * * *")).toThrow(/minute/);
  });

  it("returns today's 1 AM Eastern when it has not passed", () => {
    const next = getNextNightlyRunAt({
      now: new Date("2026-05-28T04:30:00.000Z"),
      timeZone: "America/New_York",
      cron: "0 1 * * *",
    });

    expect(next.toISOString()).toBe("2026-05-28T05:00:00.000Z");
  });

  it("returns tomorrow's 1 AM Eastern when today's run has passed", () => {
    const next = getNextNightlyRunAt({
      now: new Date("2026-05-28T06:00:00.000Z"),
      timeZone: "America/New_York",
      cron: "0 1 * * *",
    });

    expect(next.toISOString()).toBe("2026-05-29T05:00:00.000Z");
  });
});
