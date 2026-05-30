import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  buildEspnHeadshotUrl,
  espnIdFromMetadata,
  localPlayerImageUrl,
  refreshPlayerImages,
} from "@/server/players/images";

function pngResponse(body = new Uint8Array([137, 80, 78, 71]), init?: ResponseInit) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "image/png" },
    ...init,
  });
}

describe("player image cache", () => {
  it("builds ESPN headshot URLs from Sleeper metadata IDs", () => {
    expect(espnIdFromMetadata({ espn_id: "3918298" })).toBe("3918298");
    expect(espnIdFromMetadata({ espn_id: 3918298 })).toBe("3918298");
    expect(espnIdFromMetadata({ espn_id: "not-valid" })).toBeNull();

    expect(buildEspnHeadshotUrl("3918298")).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/3918298.png&w=350&h=254",
    );
    expect(localPlayerImageUrl("3918298")).toBe("/api/player-images/headshots/3918298.png");
  });

  it("downloads multiple missing images and skips any image already cached", async () => {
    const imageRoot = await mkdtemp(path.join(tmpdir(), "dynalytics-player-images-"));
    const cachedPath = path.join(imageRoot, "222.png");
    await writeFile(cachedPath, new Uint8Array([1, 2, 3]));

    const fetcher = vi.fn(async () => pngResponse());

    const result = await refreshPlayerImages({
      imageRoot,
      concurrency: 2,
      fetcher,
      players: [
        { sleeperPlayerId: "p1", fullName: "Josh Allen", metadata: { espn_id: "111" } },
        { sleeperPlayerId: "p2", fullName: "Bijan Robinson", metadata: { espn_id: "222" } },
        { sleeperPlayerId: "p3", fullName: "Mystery Player", metadata: {} },
        { sleeperPlayerId: "p4", fullName: "CeeDee Lamb", metadata: { espn_id: "333" } },
      ],
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(stat(path.join(imageRoot, "111.png"))).resolves.toMatchObject({ size: 4 });
    await expect(stat(path.join(imageRoot, "333.png"))).resolves.toMatchObject({ size: 4 });
    expect(result.counts).toMatchObject({
      playersScanned: 4,
      imagesDownloaded: 2,
      imagesSkippedCached: 1,
      playersWithoutEspnId: 1,
    });
    expect(result.warnings).toEqual([]);
  });

  it("keeps going when an individual ESPN image is unavailable", async () => {
    const imageRoot = await mkdtemp(path.join(tmpdir(), "dynalytics-player-images-"));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(pngResponse());

    const result = await refreshPlayerImages({
      imageRoot,
      concurrency: 2,
      fetcher,
      players: [
        { sleeperPlayerId: "p1", fullName: "Missing Player", metadata: { espn_id: "404" } },
        { sleeperPlayerId: "p2", fullName: "Good Player", metadata: { espn_id: "200" } },
      ],
    });

    expect(result.counts.imagesFailed).toBe(1);
    expect(result.counts.imagesDownloaded).toBe(1);
    expect(result.status).toBe("partial");
    expect(result.warnings[0]).toContain("Missing Player");
  });
});
