import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/env";
import { db } from "@/server/db/client";
import {
  appSettings,
  players,
  playerSourceIds,
  seasonStats,
  sourceSnapshots,
  weeklyStats,
  type ImportJob,
} from "@/server/db/schema";

type NflverseFetch = typeof fetch;
type CsvRow = Record<string, string | null>;
type ImportCounts = Record<string, number>;
type StatValue = number | string | null;

const DEFAULT_WRITE_BATCH_SIZE = 250;
const DEFAULT_IMPORT_SEASONS = 10;
const MAX_WARNING_MESSAGES = 25;
const FF_PLAYER_IDS_URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv";

const nflversePlayerIdSchema = z
  .object({
    gsis_id: z.string().nullish(),
    sleeper_id: z.string().or(z.number()).nullish(),
    display_name: z.string().nullish(),
    football_name: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    position: z.string().nullish(),
    latest_team: z.string().nullish(),
  })
  .passthrough();

const nflverseWeeklyStatSchema = z
  .object({
    player_id: z.string().nullish(),
    player_display_name: z.string().nullish(),
    season: z.coerce.number().int(),
    week: z.coerce.number().int(),
    season_type: z.string().nullish(),
    recent_team: z.string().nullish(),
    opponent_team: z.string().nullish(),
    position: z.string().nullish(),
    fantasy_points: z.coerce.number().nullish(),
    fantasy_points_ppr: z.coerce.number().nullish(),
  })
  .passthrough();

export type NflversePlayerId = z.infer<typeof nflversePlayerIdSchema>;
export type NflverseWeeklyStat = z.infer<typeof nflverseWeeklyStatSchema>;

export class NflverseHttpError extends Error {
  readonly temporary: boolean;

  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NflverseHttpError";
    this.temporary = status === 429 || status >= 500;
  }
}

function chunkArray<T>(items: T[], size = DEFAULT_WRITE_BATCH_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function csvRows(text: string): CsvRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      field = "";
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;

  if (!headers) {
    return [];
  }

  return dataRows.map((values) => {
    const parsed: CsvRow = {};

    headers.forEach((header, index) => {
      const value = values[index]?.trim();
      parsed[header] = value && value !== "NA" && value !== "NaN" ? value : null;
    });

    return parsed;
  });
}

function numberValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown) {
  if (value == null) {
    return null;
  }

  const stringified = String(value).trim();
  return stringified === "" || stringified === "NA" || stringified === "NaN" ? null : stringified;
}

function statPayload(row: Record<string, unknown>) {
  const stats: Record<string, StatValue> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) {
      continue;
    }

    const numeric = numberValue(value);
    stats[key] = numeric ?? stringValue(value);
  }

  return stats;
}

function sourceUrl(baseUrl: string, release: string, fileName: string) {
  return `${baseUrl.replace(/\/$/, "")}/${release}/${fileName}`;
}

export function latestAvailableSeasons(rows: Pick<NflverseWeeklyStat, "season">[], count = DEFAULT_IMPORT_SEASONS) {
  return Array.from(new Set(rows.map((row) => row.season)))
    .filter((season) => Number.isInteger(season))
    .sort((left, right) => right - left)
    .slice(0, count);
}

function weeklyStatId(row: {
  sleeperPlayerId: string | null;
  gsisId: string | null;
  playerName: string | null;
  season: number;
  week: number;
  seasonType: string;
}) {
  return [
    "nflverse",
    row.season,
    row.week,
    row.seasonType,
    row.sleeperPlayerId ?? row.gsisId ?? row.playerName ?? randomUUID(),
  ].join(":");
}

function seasonStatId(row: {
  sleeperPlayerId: string | null;
  gsisId: string | null;
  playerName: string | null;
  season: number;
  seasonType: string;
}) {
  return ["nflverse", row.season, row.seasonType, row.sleeperPlayerId ?? row.gsisId ?? row.playerName ?? randomUUID()].join(
    ":",
  );
}

async function storeSnapshot(input: { sourceKey: string; season?: number | null; week?: number | null; payload: unknown }) {
  await db
    .insert(sourceSnapshots)
    .values({
      id: randomUUID(),
      source: "nflverse",
      sourceKey: input.sourceKey,
      season: input.season ?? null,
      week: input.week ?? null,
      payload: input.payload,
      capturedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [sourceSnapshots.source, sourceSnapshots.sourceKey],
      set: {
        season: input.season ?? null,
        week: input.week ?? null,
        payload: input.payload,
        capturedAt: new Date(),
      },
    });
}

async function setAppSetting(key: string, value: unknown) {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export class NflverseClient {
  constructor(
    private readonly options: {
      baseUrl?: string;
      fetcher?: NflverseFetch;
    } = {},
  ) {}

  private async getCsvUrl<T>(url: string, schema: z.ZodType<T>) {
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(url);

    if (!response.ok) {
      throw new NflverseHttpError(`nflverse request failed with HTTP ${response.status} for ${url}.`, response.status);
    }

    return csvRows(await response.text()).map((row) => schema.parse(row));
  }

  private async getCsv<T>(release: string, fileName: string, schema: z.ZodType<T>) {
    const baseUrl = this.options.baseUrl ?? env.NFLVERSE_BASE_URL;
    return this.getCsvUrl(sourceUrl(baseUrl, release, fileName), schema);
  }

  getPlayerIds() {
    return this.getCsvUrl(FF_PLAYER_IDS_URL, nflversePlayerIdSchema);
  }

  getWeeklyStats() {
    return this.getCsv("player_stats", "player_stats.csv", nflverseWeeklyStatSchema);
  }
}

export function getNflverseServiceStatus() {
  return {
    source: "nflverse" as const,
    baseUrl: env.NFLVERSE_BASE_URL,
    mode: "read-only" as const,
  };
}

function playerIdBridgeRows(rows: NflversePlayerId[]) {
  return rows.flatMap((row) => {
    const gsisId = stringValue(row.gsis_id);
    const sleeperPlayerId = stringValue(row.sleeper_id);

    if (!gsisId || !sleeperPlayerId) {
      return [];
    }

    return [{ gsisId, sleeperPlayerId, metadata: row }];
  });
}

async function existingSleeperIds(sleeperPlayerIds: string[]) {
  const uniqueIds = Array.from(new Set(sleeperPlayerIds));
  const existing = new Set<string>();

  for (const batch of chunkArray(uniqueIds, 500)) {
    const rows = await db
      .select({ sleeperPlayerId: players.sleeperPlayerId })
      .from(players)
      .where(inArray(players.sleeperPlayerId, batch));

    rows.forEach((row) => existing.add(row.sleeperPlayerId));
  }

  return existing;
}

async function importPlayerIdBridge(client: NflverseClient, timestamp: Date) {
  const rows = await client.getPlayerIds();
  const bridgeRows = playerIdBridgeRows(rows);
  const existing = await existingSleeperIds(bridgeRows.map((row) => row.sleeperPlayerId));
  const importableRows = bridgeRows.filter((row) => existing.has(row.sleeperPlayerId));
  let sourceIdsImported = 0;

  for (const batch of chunkArray(
    importableRows.map((row) => ({
      sleeperPlayerId: row.sleeperPlayerId,
      source: "gsis",
      sourcePlayerId: row.gsisId,
      metadata: row.metadata,
      updatedAt: timestamp,
    })),
  )) {
    await db
      .insert(playerSourceIds)
      .values(batch)
      .onConflictDoUpdate({
        target: [playerSourceIds.source, playerSourceIds.sourcePlayerId],
        set: {
          sleeperPlayerId: sql`excluded.sleeper_player_id`,
          metadata: sql`excluded.metadata`,
          updatedAt: timestamp,
        },
      });
    sourceIdsImported += batch.length;
  }

  await storeSnapshot({
    sourceKey: "players:ids",
    payload: {
      url: sourceUrl(env.NFLVERSE_BASE_URL, "players", "players.csv"),
      bridgeUrl: FF_PLAYER_IDS_URL,
      rowsSeen: rows.length,
      mappingsSeen: bridgeRows.length,
      importedAt: timestamp.toISOString(),
    },
  });

  await setAppSetting("nflverse.playerIds.lastImportedAt", { importedAt: timestamp.toISOString() });

  return {
    counts: {
      playerIdsSeen: rows.length,
      playerIdsMapped: bridgeRows.length,
      playerIdsImported: sourceIdsImported,
      playerIdsSkipped: bridgeRows.length - sourceIdsImported,
      snapshotsStored: 1,
    },
    warnings:
      bridgeRows.length === sourceIdsImported
        ? []
        : [`${bridgeRows.length - sourceIdsImported} nflverse player ID mappings did not match a Sleeper player yet.`],
  };
}

async function gsisToSleeperMap() {
  const rows = await db
    .select({
      gsisId: playerSourceIds.sourcePlayerId,
      sleeperPlayerId: playerSourceIds.sleeperPlayerId,
    })
    .from(playerSourceIds)
    .where(eq(playerSourceIds.source, "gsis"));

  return new Map(rows.map((row) => [row.gsisId, row.sleeperPlayerId]));
}

export function deriveSeasonSummaries(rows: Array<ReturnType<typeof normalizeWeeklyRow>>) {
  const summaries = new Map<
    string,
    {
      sleeperPlayerId: string | null;
      gsisId: string | null;
      playerName: string | null;
      season: number;
      seasonType: string;
      team: string | null;
      position: string | null;
      games: Set<number>;
      stats: Record<string, number>;
      fantasyPointsPpr: number | null;
      fantasyPointsHalfPpr: number | null;
      fantasyPointsStandard: number | null;
    }
  >();

  for (const row of rows) {
    const key = seasonStatId(row);
    const existing =
      summaries.get(key) ??
      {
        sleeperPlayerId: row.sleeperPlayerId,
        gsisId: row.gsisId,
        playerName: row.playerName,
        season: row.season,
        seasonType: row.seasonType,
        team: row.team,
        position: row.position,
        games: new Set<number>(),
        stats: {},
        fantasyPointsPpr: null,
        fantasyPointsHalfPpr: null,
        fantasyPointsStandard: null,
      };

    existing.team = row.team ?? existing.team;
    existing.position = row.position ?? existing.position;
    existing.games.add(row.week);

    for (const [stat, value] of Object.entries(row.stats)) {
      if (typeof value === "number") {
        existing.stats[stat] = (existing.stats[stat] ?? 0) + value;
      }
    }

    existing.fantasyPointsPpr =
      row.fantasyPointsPpr == null
        ? existing.fantasyPointsPpr
        : (existing.fantasyPointsPpr ?? 0) + row.fantasyPointsPpr;
    existing.fantasyPointsHalfPpr =
      row.fantasyPointsHalfPpr == null
        ? existing.fantasyPointsHalfPpr
        : (existing.fantasyPointsHalfPpr ?? 0) + row.fantasyPointsHalfPpr;
    existing.fantasyPointsStandard =
      row.fantasyPointsStandard == null
        ? existing.fantasyPointsStandard
        : (existing.fantasyPointsStandard ?? 0) + row.fantasyPointsStandard;

    summaries.set(key, existing);
  }

  return Array.from(summaries.values()).map((summary) => ({
    ...summary,
    id: seasonStatId(summary),
    games: summary.games.size,
  }));
}

function normalizeWeeklyRow(row: NflverseWeeklyStat, map: Map<string, string>) {
  const gsisId = stringValue(row.player_id);
  const sleeperPlayerId = gsisId ? (map.get(gsisId) ?? null) : null;
  const seasonType = stringValue(row.season_type) ?? "REG";
  const stats = statPayload(row);
  const standard = numberValue(row.fantasy_points);
  const ppr = numberValue(row.fantasy_points_ppr);

  return {
    id: weeklyStatId({
      sleeperPlayerId,
      gsisId,
      playerName: stringValue(row.player_display_name),
      season: row.season,
      week: row.week,
      seasonType,
    }),
    sleeperPlayerId,
    gsisId,
    playerName: stringValue(row.player_display_name),
    season: row.season,
    week: row.week,
    seasonType,
    team: stringValue(row.recent_team),
    opponent: stringValue(row.opponent_team),
    position: stringValue(row.position),
    stats,
    fantasyPointsPpr: ppr,
    fantasyPointsHalfPpr: ppr != null && standard != null ? (ppr + standard) / 2 : null,
    fantasyPointsStandard: standard,
  };
}

async function importStats(input: {
  client: NflverseClient;
  timestamp: Date;
  seasons: number[] | null;
  week?: number | null;
  writeWeekly: boolean;
  writeSeason: boolean;
}) {
  const map = await gsisToSleeperMap();
  const sourceRows = await input.client.getWeeklyStats();
  const seasons = input.seasons ?? latestAvailableSeasons(sourceRows);
  const weeklyRows = sourceRows
    .filter((row) => seasons.includes(row.season))
    .filter((row) => (input.week ? row.week === input.week : true))
    .map((row) => normalizeWeeklyRow(row, map));
  const unmappedRows = weeklyRows.filter((row) => row.gsisId && !row.sleeperPlayerId);
  let weeklyStatsImported = 0;
  let seasonStatsImported = 0;
  let snapshotsStored = 0;

  if (input.writeWeekly) {
    await db.delete(weeklyStats).where(
      input.week
        ? and(inArray(weeklyStats.season, seasons), eq(weeklyStats.week, input.week))
        : inArray(weeklyStats.season, seasons),
    );

    for (const batch of chunkArray(
      weeklyRows.map((row) => ({
        id: row.id,
        sleeperPlayerId: row.sleeperPlayerId,
        gsisId: row.gsisId,
        season: row.season,
        week: row.week,
        seasonType: row.seasonType,
        team: row.team,
        opponent: row.opponent,
        position: row.position,
        stats: row.stats,
        fantasyPointsPpr: row.fantasyPointsPpr,
        fantasyPointsHalfPpr: row.fantasyPointsHalfPpr,
        fantasyPointsStandard: row.fantasyPointsStandard,
        sourceUpdatedAt: input.timestamp,
      })),
    )) {
      await db.insert(weeklyStats).values(batch);
      weeklyStatsImported += batch.length;
    }
  }

  const summaries = deriveSeasonSummaries(weeklyRows);

  if (input.writeSeason) {
    await db.delete(seasonStats).where(inArray(seasonStats.season, seasons));

    for (const batch of chunkArray(
      summaries.map((row) => ({
        id: row.id,
        sleeperPlayerId: row.sleeperPlayerId,
        gsisId: row.gsisId,
        season: row.season,
        seasonType: row.seasonType,
        team: row.team,
        position: row.position,
        games: row.games,
        stats: row.stats,
        fantasyPointsPpr: row.fantasyPointsPpr,
        fantasyPointsHalfPpr: row.fantasyPointsHalfPpr,
        fantasyPointsStandard: row.fantasyPointsStandard,
        sourceUpdatedAt: input.timestamp,
      })),
    )) {
      await db.insert(seasonStats).values(batch);
      seasonStatsImported += batch.length;
    }
  }

  await storeSnapshot({
    sourceKey: `player_stats:${seasons.join(",")}${input.week ? `:week:${input.week}` : ""}`,
    week: input.week ?? null,
    payload: {
      url: sourceUrl(env.NFLVERSE_BASE_URL, "player_stats", "player_stats.csv"),
      seasons,
      week: input.week ?? null,
      rowsSeen: weeklyRows.length,
      importedAt: input.timestamp.toISOString(),
    },
  });
  snapshotsStored += 1;

  await setAppSetting("nflverse.stats.lastImportedAt", {
    importedAt: input.timestamp.toISOString(),
    seasons,
    week: input.week ?? null,
  });

  return {
    counts: {
      weeklyStatsSeen: weeklyRows.length,
      weeklyStatsImported,
      seasonStatsImported,
      unmappedStatRows: unmappedRows.length,
      snapshotsStored,
      seasonsImported: seasons.length,
    },
    warnings: [
      ...unmappedRows.slice(0, MAX_WARNING_MESSAGES).map((row) => {
        const player = row.playerName ? `${row.playerName} (${row.gsisId})` : row.gsisId;
        return `No Sleeper mapping found for nflverse player ${player}.`;
      }),
      ...(unmappedRows.length > MAX_WARNING_MESSAGES
        ? [`${unmappedRows.length - MAX_WARNING_MESSAGES} additional nflverse stat rows are unmapped.`]
        : []),
    ],
  };
}

function mergeResult(
  base: { counts: ImportCounts; warnings: string[] },
  next: { counts: ImportCounts; warnings: string[] },
) {
  for (const [key, value] of Object.entries(next.counts)) {
    base.counts[key] = (base.counts[key] ?? 0) + value;
  }

  base.warnings.push(...next.warnings);
  return base;
}

export async function importNflverseJob(job: ImportJob, client = new NflverseClient()) {
  const timestamp = new Date();
  const seasons =
    typeof job.metadata === "object" && job.metadata !== null && Array.isArray(job.metadata.seasons)
      ? job.metadata.seasons.map(Number).filter((season) => Number.isInteger(season))
      : job.season
        ? [job.season]
        : null;
  const result = { counts: {} as ImportCounts, warnings: [] as string[] };
  const scope = job.scope ?? "full";

  if (scope === "ids" || scope === "full") {
    mergeResult(result, await importPlayerIdBridge(client, timestamp));
  }

  if (scope === "weekly" || scope === "season" || scope === "full") {
    mergeResult(
      result,
      await importStats({
        client,
        timestamp,
        seasons,
        week: job.week,
        writeWeekly: scope === "weekly" || scope === "full",
        writeSeason: scope === "season" || scope === "full",
      }),
    );
  }

  return {
    status: result.warnings.length > 0 ? ("partial" as const) : ("succeeded" as const),
    counts: result.counts,
    warnings: result.warnings,
    metadata: {
      ...(job.metadata ?? {}),
      readOnly: true,
    },
  };
}
