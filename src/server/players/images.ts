import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { asc } from "drizzle-orm";

import { db } from "@/server/db/client";
import { players } from "@/server/db/schema";

const ESPN_HEADSHOT_BASE_URL = "https://a.espncdn.com/combiner/i";
const DEFAULT_IMAGE_ROOT = path.join(process.cwd(), "data", "player-images", "headshots");
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_MAX_WARNINGS = 25;

type PlayerImageCandidate = {
  sleeperPlayerId: string;
  fullName: string;
  metadata: Record<string, unknown> | null;
};

type RefreshPlayerImagesOptions = {
  imageRoot?: string;
  fetcher?: typeof fetch;
  players?: PlayerImageCandidate[];
  concurrency?: number;
  force?: boolean;
  maxWarnings?: number;
};

type ImageDownloadResult =
  | { status: "downloaded" }
  | { status: "skippedCached" }
  | { status: "failed"; warning: string };

export function espnIdFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.espn_id;
  const id = typeof value === "number" ? String(value) : typeof value === "string" ? value : null;

  return id && /^\d+$/.test(id) ? id : null;
}

export function buildEspnHeadshotUrl(espnId: string) {
  return `${ESPN_HEADSHOT_BASE_URL}?img=/i/headshots/nfl/players/full/${espnId}.png&w=350&h=254`;
}

export function localPlayerImageUrl(espnId: string) {
  return `/api/player-images/headshots/${espnId}.png`;
}

export function playerImageRoot() {
  return DEFAULT_IMAGE_ROOT;
}

export function playerImagePath(espnId: string, imageRoot = DEFAULT_IMAGE_ROOT) {
  if (!/^\d+$/.test(espnId)) {
    return null;
  }

  return path.join(imageRoot, `${espnId}.png`);
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

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem) => Promise<TResult>,
) {
  const results: TResult[] = [];
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

async function downloadImage(input: {
  espnId: string;
  fullName: string;
  imageRoot: string;
  fetcher: typeof fetch;
  force: boolean;
}): Promise<ImageDownloadResult> {
  const filePath = playerImagePath(input.espnId, input.imageRoot);

  if (!filePath) {
    return { status: "failed", warning: `${input.fullName} has an invalid ESPN image id.` };
  }

  if (!input.force && (await fileExists(filePath))) {
    return { status: "skippedCached" };
  }

  const response = await input.fetcher(buildEspnHeadshotUrl(input.espnId));

  if (!response.ok) {
    return { status: "failed", warning: `${input.fullName} ESPN image returned HTTP ${response.status}.` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("image/")) {
    return { status: "failed", warning: `${input.fullName} ESPN image returned ${contentType || "unknown content"}.` };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    return { status: "failed", warning: `${input.fullName} ESPN image was empty.` };
  }

  const tmpPath = path.join(input.imageRoot, `.${input.espnId}.${randomUUID()}.tmp`);
  await writeFile(tmpPath, bytes);
  await rename(tmpPath, filePath);

  return { status: "downloaded" };
}

export async function playerImageExists(espnId: string, imageRoot = DEFAULT_IMAGE_ROOT) {
  const filePath = playerImagePath(espnId, imageRoot);
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
        const match = /^(\d+)\.png$/i.exec(entry);
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

export async function refreshPlayerImages(options: RefreshPlayerImagesOptions = {}) {
  const imageRoot = options.imageRoot ?? DEFAULT_IMAGE_ROOT;
  const fetcher = options.fetcher ?? fetch;
  const force = options.force ?? false;
  const maxWarnings = options.maxWarnings ?? DEFAULT_MAX_WARNINGS;
  const candidates = options.players ?? (await loadPlayerImageCandidates());
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY));
  const warnings: string[] = [];
  const counts = {
    playersScanned: candidates.length,
    playersWithEspnId: 0,
    playersWithoutEspnId: 0,
    imagesDownloaded: 0,
    imagesSkippedCached: 0,
    imagesFailed: 0,
  };

  await mkdir(imageRoot, { recursive: true });

  const withEspnIds = candidates.flatMap((player) => {
    const espnId = espnIdFromMetadata(player.metadata);
    if (!espnId) {
      counts.playersWithoutEspnId += 1;
      return [];
    }

    counts.playersWithEspnId += 1;
    return [{ ...player, espnId }];
  });

  const results = await mapWithConcurrency(withEspnIds, concurrency, (player) =>
    downloadImage({
      espnId: player.espnId,
      fullName: player.fullName,
      imageRoot,
      fetcher,
      force,
    }),
  );

  for (const result of results) {
    if (result.status === "downloaded") {
      counts.imagesDownloaded += 1;
    } else if (result.status === "skippedCached") {
      counts.imagesSkippedCached += 1;
    } else {
      counts.imagesFailed += 1;
      if (warnings.length < maxWarnings) {
        warnings.push(result.warning);
      }
    }
  }

  return {
    status: counts.imagesFailed > 0 ? ("partial" as const) : ("succeeded" as const),
    counts,
    warnings,
    metadata: {
      imageRoot,
      source: "espn",
      cachePolicy: force ? "replace-existing" : "missing-only",
      concurrency,
      force,
    },
  };
}
