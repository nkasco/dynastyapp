import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db/client";
import { appSettings } from "@/server/db/schema";
import {
  gsisIdFromMetadata,
  localPlayerImageUrl,
  playerHeadshotsZipUrl,
  refreshPlayerImages,
} from "@/server/players/images";
import { eq } from "drizzle-orm";

const PLAYER_IMAGES_SETTING_KEY = "playerImages.gsisHeadshots.lastRefreshedAt";

afterEach(async () => {
  await db.delete(appSettings).where(eq(appSettings.key, PLAYER_IMAGES_SETTING_KEY));
});

function zipResponse(body = new Uint8Array([80, 75, 3, 4]), init?: ResponseInit) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/zip" },
    ...init,
  });
}

describe("player image cache", () => {
  it("builds local GSIS headshot URLs", () => {
    expect(gsisIdFromMetadata({ gsis_id: "00-0023459" })).toBe("00-0023459");
    expect(gsisIdFromMetadata({ gsis_id: "not-valid" })).toBeNull();

    expect(playerHeadshotsZipUrl()).toBe("https://www.nflgsis.com/statsinabox/CurrentRelease/Headshots.zip");
    expect(localPlayerImageUrl("00-0023459")).toBe("/api/player-images/headshots/00-0023459.jpg");
  });

  it("downloads the GSIS archive and extracts matching headshots", async () => {
    const imageRoot = await mkdtemp(path.join(tmpdir(), "dynalytics-player-images-"));
    const cachedPath = path.join(imageRoot, "00-0022222.jpg");
    await writeFile(cachedPath, new Uint8Array([255, 216, 255]));

    const fetcher = vi.fn(async () => zipResponse());
    const extractor = vi.fn(async () => {
      await writeFile(path.join(imageRoot, "00-0011111.jpg"), new Uint8Array([255, 216, 255, 217]));
      await writeFile(path.join(imageRoot, "00-0033333.jpg"), new Uint8Array([255, 216, 255, 217]));
      return { extracted: 2, skippedExisting: 1, ignored: 1, warnings: [] };
    });

    const result = await refreshPlayerImages({
      imageRoot,
      force: true,
      fetcher,
      extractor,
      players: [
        { sleeperPlayerId: "p1", fullName: "Aaron Rodgers", metadata: { gsis_id: "00-0023459" } },
        { sleeperPlayerId: "p2", fullName: "Josh Allen", metadata: { gsis_id: "00-0034857" } },
        { sleeperPlayerId: "p3", fullName: "Mystery Player", metadata: {} },
      ],
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://www.nflgsis.com/statsinabox/CurrentRelease/Headshots.zip");
    expect(extractor).toHaveBeenCalledTimes(1);
    await expect(stat(path.join(imageRoot, "00-0011111.jpg"))).resolves.toMatchObject({ size: 4 });
    await expect(stat(path.join(imageRoot, "00-0033333.jpg"))).resolves.toMatchObject({ size: 4 });
    await expect(stat(cachedPath)).resolves.toMatchObject({ size: 3 });
    expect(result.counts).toMatchObject({
      playersScanned: 3,
      playersWithGsisId: 2,
      imagesExtracted: 2,
      imagesSkippedCached: 1,
      playersWithoutGsisId: 1,
      archivesDownloaded: 1,
    });
    expect(result.warnings).toEqual([]);
  });

  it("reports archive download failures", async () => {
    const imageRoot = await mkdtemp(path.join(tmpdir(), "dynalytics-player-images-"));
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("not found", { status: 404 }));

    const result = await refreshPlayerImages({
      imageRoot,
      force: true,
      fetcher,
      players: [
        { sleeperPlayerId: "p1", fullName: "Aaron Rodgers", metadata: { gsis_id: "00-0023459" } },
      ],
    });

    expect(result.counts.archivesDownloaded).toBe(0);
    expect(result.status).toBe("failed");
    expect(result.warnings[0]).toContain("HTTP 404");
  });
});
