import { describe, expect, it } from "vitest";

import { SleeperClient, SleeperHttpError } from "@/server/sleeper/service";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("Sleeper client", () => {
  it("fetches from the configured base URL and validates player payloads", async () => {
    const seenUrls: string[] = [];
    const client = new SleeperClient({
      baseUrl: "https://example.test/v1",
      minRequestIntervalMs: 0,
      fetcher: async (input) => {
        seenUrls.push(String(input));
        return jsonResponse({
          "123": {
            player_id: "123",
            full_name: "Bijan Robinson",
            position: "RB",
            team: "ATL",
            fantasy_positions: ["RB"],
          },
        });
      },
    });

    await expect(client.getPlayers()).resolves.toMatchObject({
      "123": {
        player_id: "123",
        full_name: "Bijan Robinson",
      },
    });
    expect(seenUrls).toEqual(["https://example.test/v1/players/nfl"]);
  });

  it("marks 429 and 5xx responses as temporary import failures", async () => {
    const client = new SleeperClient({
      baseUrl: "https://example.test/v1",
      minRequestIntervalMs: 0,
      fetcher: async () => jsonResponse({ error: "slow down" }, { status: 429 }),
    });

    await expect(client.getLeague("league-1")).rejects.toMatchObject({
      temporary: true,
      status: 429,
    } satisfies Partial<SleeperHttpError>);
  });
});

describe.skipIf(process.env.LIVE_SLEEPER_TESTS !== "1")("Sleeper client live API", () => {
  it("validates the real /players/nfl payload", async () => {
    const client = new SleeperClient({ minRequestIntervalMs: 0 });
    const players = await client.getPlayers();

    expect(Object.keys(players).length).toBeGreaterThan(1000);
    expect(Object.values(players).some((player) => player.player_id && player.position)).toBe(true);
  }, 30000);
});
