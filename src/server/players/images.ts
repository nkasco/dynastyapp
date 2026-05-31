import "server-only";

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db/client";
import { appSettings, playerSourceIds, players } from "@/server/db/schema";

const NFL_GSIS_HEADSHOTS_URL = "https://www.nflgsis.com/statsinabox/CurrentRelease/Headshots.zip";
const DEFAULT_IMAGE_ROOT = path.join(process.cwd(), "data", "player-images", "headshots");
const DEFAULT_REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_WARNINGS = 25;
const LAST_REFRESHED_SETTING_KEY = "playerImages.gsisHeadshots.lastRefreshedAt";
const execFileAsync = promisify(execFile);

type PlayerImageCandidate = {
  sleeperPlayerId: string;
  fullName: string;
  metadata: Record<string, unknown> | null;
};

type RefreshPlayerImagesOptions = {
  imageRoot?: string;
  fetcher?: typeof fetch;
  players?: PlayerImageCandidate[];
  force?: boolean;
  maxWarnings?: number;
  now?: Date;
  refreshIntervalMs?: number;
  zipUrl?: string;
  extractor?: (input: { zipPath: string; imageRoot: string; force: boolean }) => Promise<ExtractHeadshotsResult>;
};

type ExtractHeadshotsResult = {
  extracted: number;
  skippedExisting: number;
  ignored: number;
  warnings: string[];
};

export function gsisIdFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.gsis_id;
  const id = typeof value === "number" ? String(value) : typeof value === "string" ? value : null;

  return id && /^\d{2}-\d{7}$/.test(id) ? id : null;
}

export function playerHeadshotsZipUrl() {
  return NFL_GSIS_HEADSHOTS_URL;
}

export function localPlayerImageUrl(gsisId: string) {
  return `/api/player-images/headshots/${gsisId}.jpg`;
}

export function playerImageRoot() {
  return DEFAULT_IMAGE_ROOT;
}

export function playerImagePath(gsisId: string, imageRoot = DEFAULT_IMAGE_ROOT) {
  if (!/^\d{2}-\d{7}$/.test(gsisId)) {
    return null;
  }

  return path.join(imageRoot, `${gsisId}.jpg`);
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function loadPlayerImageCandidates() {
  return db
    .select({
      sleeperPlayerId: players.sleeperPlayerId,
      fullName: players.fullName,
      metadata: players.metadata,
    })
    .from(players)
    .orderBy(asc(players.fullName));
}

export async function playerImageExists(gsisId: string, imageRoot = DEFAULT_IMAGE_ROOT) {
  const filePath = playerImagePath(gsisId, imageRoot);
  if (!filePath) {
    return false;
  }

  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function cachedPlayerImageIds(imageRoot = DEFAULT_IMAGE_ROOT) {
  try {
    const entries = await readdir(imageRoot);
    return new Set(
      entries.flatMap((entry) => {
        const match = /^(\d{2}-\d{7})\.jpg$/i.exec(entry);
        return match?.[1] ? [match[1]] : [];
      }),
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return new Set<string>();
    }

    throw error;
  }
}

async function appSettingDate(key: string) {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  const value = row?.value;

  if (!value || typeof value !== "object" || !("refreshedAt" in value) || typeof value.refreshedAt !== "string") {
    return null;
  }

  const date = new Date(value.refreshedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function setAppSetting(key: string, value: unknown) {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

function isFresh(lastRefreshedAt: Date | null, now: Date, refreshIntervalMs: number) {
  return Boolean(lastRefreshedAt && now.getTime() - lastRefreshedAt.getTime() < refreshIntervalMs);
}

async function extractHeadshotsWithUnzip(input: {
  zipPath: string;
  imageRoot: string;
  force: boolean;
}): Promise<ExtractHeadshotsResult> {
  const tmpRoot = path.join(input.imageRoot, `.extract-${randomUUID()}`);
  await mkdir(tmpRoot, { recursive: true });

  try {
    await execFileAsync("unzip", ["-qq", input.zipPath, "-d", tmpRoot], { maxBuffer: 1024 * 1024 });
    const entries = await readdir(tmpRoot, { recursive: true, withFileTypes: true });
    const warnings: string[] = [];
    let extracted = 0;
    let skippedExisting = 0;
    let ignored = 0;

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const match = /^(\d{2}-\d{7})_headshot\.jpg$/i.exec(entry.name);
      if (!match?.[1]) {
        ignored += 1;
        continue;
      }

      const targetPath = playerImagePath(match[1], input.imageRoot);
      if (!targetPath) {
        ignored += 1;
        continue;
      }

      if (!input.force && (await fileExists(targetPath))) {
        skippedExisting += 1;
        continue;
      }

      const sourcePath = path.join(entry.parentPath, entry.name);
      const tmpTargetPath = path.join(input.imageRoot, `.${match[1]}.${randomUUID()}.tmp`);
      await rename(sourcePath, tmpTargetPath);
      await rename(tmpTargetPath, targetPath);
      extracted += 1;
    }

    return { extracted, skippedExisting, ignored, warnings };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

export async function refreshPlayerImages(options: RefreshPlayerImagesOptions = {}) {
  const imageRoot = options.imageRoot ?? DEFAULT_IMAGE_ROOT;
  const fetcher = options.fetcher ?? fetch;
  const force = options.force ?? false;
  const maxWarnings = options.maxWarnings ?? DEFAULT_MAX_WARNINGS;
  const now = options.now ?? new Date();
  const refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
  const zipUrl = options.zipUrl ?? NFL_GSIS_HEADSHOTS_URL;
  const extractor = options.extractor ?? extractHeadshotsWithUnzip;
  const candidates = options.players ?? (await loadPlayerImageCandidates());
  const warnings: string[] = [];
  const counts = {
    playersScanned: candidates.length,
    playersWithGsisId: 0,
    playersWithoutGsisId: 0,
    imagesExtracted: 0,
    imagesSkippedCached: 0,
    archiveFilesIgnored: 0,
    archivesDownloaded: 0,
    refreshesSkippedFresh: 0,
  };

  await mkdir(imageRoot, { recursive: true });

  for (const player of candidates) {
    const gsisId = gsisIdFromMetadata(player.metadata);
    if (!gsisId) {
      counts.playersWithoutGsisId += 1;
    } else {
      counts.playersWithGsisId += 1;
    }
  }

  const lastRefreshedAt = await appSettingDate(LAST_REFRESHED_SETTING_KEY);
  if (!force && isFresh(lastRefreshedAt, now, refreshIntervalMs)) {
    counts.refreshesSkippedFresh = 1;

    return {
      status: "succeeded" as const,
      counts,
      warnings,
      metadata: {
        imageRoot,
        source: "nfl-gsis",
        zipUrl,
        cachePolicy: "fresh-cache",
        refreshIntervalDays: Math.round(refreshIntervalMs / (24 * 60 * 60 * 1000)),
        lastRefreshedAt: lastRefreshedAt?.toISOString() ?? null,
        force,
      },
    };
  }

  const response = await fetcher(zipUrl);

  if (!response.ok) {
    return {
      status: "failed" as const,
      counts,
      warnings: [`NFL GSIS headshot archive returned HTTP ${response.status}.`],
      metadata: {
        imageRoot,
        source: "nfl-gsis",
        zipUrl,
        cachePolicy: force ? "replace-existing" : "missing-only",
        refreshIntervalDays: Math.round(refreshIntervalMs / (24 * 60 * 60 * 1000)),
        lastRefreshedAt: lastRefreshedAt?.toISOString() ?? null,
        force,
      },
    };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    return {
      status: "failed" as const,
      counts,
      warnings: ["NFL GSIS headshot archive was empty."],
      metadata: {
        imageRoot,
        source: "nfl-gsis",
        zipUrl,
        cachePolicy: force ? "replace-existing" : "missing-only",
        refreshIntervalDays: Math.round(refreshIntervalMs / (24 * 60 * 60 * 1000)),
        lastRefreshedAt: lastRefreshedAt?.toISOString() ?? null,
        force,
      },
    };
  }

  const zipPath = path.join(imageRoot, `.Headshots.${randomUUID()}.zip`);
  await writeFile(zipPath, bytes);
  counts.archivesDownloaded = 1;

  try {
    const result = await extractor({ zipPath, imageRoot, force });
    counts.imagesExtracted = result.extracted;
    counts.imagesSkippedCached = result.skippedExisting;
    counts.archiveFilesIgnored = result.ignored;
    warnings.push(...result.warnings.slice(0, maxWarnings));

    await setAppSetting(LAST_REFRESHED_SETTING_KEY, {
      refreshedAt: now.toISOString(),
      zipUrl,
      imageRoot,
      imagesExtracted: result.extracted,
      imagesSkippedCached: result.skippedExisting,
      archiveFilesIgnored: result.ignored,
    });

    return {
      status: warnings.length > 0 ? ("partial" as const) : ("succeeded" as const),
      counts,
      warnings,
      metadata: {
        imageRoot,
        source: "nfl-gsis",
        zipUrl,
        cachePolicy: force ? "replace-existing" : "missing-only",
        refreshIntervalDays: Math.round(refreshIntervalMs / (24 * 60 * 60 * 1000)),
        lastRefreshedAt: lastRefreshedAt?.toISOString() ?? null,
        force,
      },
    };
  } finally {
    await rm(zipPath, { force: true });
  }
}

export async function gsisIdsForSleeperPlayers(sleeperPlayerIds: string[]) {
  if (sleeperPlayerIds.length === 0) {
    return new Map<string, string>();
  }

  const rows = await db
    .select({
      sleeperPlayerId: playerSourceIds.sleeperPlayerId,
      gsisId: playerSourceIds.sourcePlayerId,
    })
    .from(playerSourceIds)
    .where(and(eq(playerSourceIds.source, "gsis"), inArray(playerSourceIds.sleeperPlayerId, sleeperPlayerIds)));

  return new Map(rows.map((row) => [row.sleeperPlayerId, row.gsisId] as const));
}
