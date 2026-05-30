import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/env";
import { db } from "@/server/db/client";
import {
  appSettings,
  draftPicks,
  drafts,
  leagueUsers,
  leagues,
  matchups,
  players,
  rosterPlayers,
  rosters,
  sourceSnapshots,
  tradedPicks,
  transactions,
  type ImportJob,
} from "@/server/db/schema";

type SleeperFetch = typeof fetch;
type JsonObject = Record<string, unknown>;
type ImportCounts = Record<string, number>;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WEEKS = 18;
const DEFAULT_MIN_REQUEST_INTERVAL_MS = 250;
const DEFAULT_WRITE_BATCH_SIZE = 250;

const sleeperPlayerSchema = z
  .object({
    player_id: z.string(),
    full_name: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    search_full_name: z.string().nullish(),
    position: z.string().nullish(),
    team: z.string().nullish(),
    status: z.string().nullish(),
    age: z.number().nullish(),
    birth_date: z.string().nullish(),
    years_exp: z.number().int().nullish(),
    fantasy_positions: z.array(z.string()).nullish(),
  })
  .passthrough();

const sleeperPlayersResponseSchema = z.record(z.string(), sleeperPlayerSchema);

const sleeperLeagueSchema = z
  .object({
    league_id: z.string(),
    name: z.string().nullish(),
    avatar: z.string().nullish(),
    season: z.string(),
    status: z.string().nullish(),
    sport: z.string().nullish(),
    scoring_settings: z.record(z.string(), z.unknown()).nullish(),
    roster_positions: z.array(z.string()).nullish(),
    settings: z.record(z.string(), z.unknown()).nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const sleeperUserSchema = z
  .object({
    user_id: z.string(),
    display_name: z.string().nullish(),
    username: z.string().nullish(),
    avatar: z.string().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const sleeperRosterSchema = z
  .object({
    roster_id: z.number().int(),
    owner_id: z.string().nullish(),
    co_owners: z.array(z.string()).nullish(),
    players: z.array(z.string()).nullish(),
    starters: z.array(z.string()).nullish(),
    taxi: z.array(z.string()).nullish(),
    reserve: z.array(z.string()).nullish(),
    settings: z.record(z.string(), z.unknown()).nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const sleeperMatchupSchema = z
  .object({
    roster_id: z.number().int(),
    matchup_id: z.number().int().nullish(),
    points: z.number().nullish(),
    starters: z.array(z.string()).nullish(),
    players: z.array(z.string()).nullish(),
    players_points: z.record(z.string(), z.number()).nullish(),
  })
  .passthrough();

const sleeperTransactionSchema = z
  .object({
    transaction_id: z.string(),
    type: z.string(),
    status: z.string().nullish(),
    roster_ids: z.array(z.number()).nullish(),
    adds: z.record(z.string(), z.number()).nullish(),
    drops: z.record(z.string(), z.number()).nullish(),
    draft_picks: z.array(z.unknown()).nullish(),
    waiver_budget: z.array(z.unknown()).nullish(),
    created: z.number().nullish(),
    status_updated: z.number().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const sleeperTradedPickSchema = z
  .object({
    season: z.string(),
    round: z.number().int(),
    roster_id: z.number().int(),
    owner_id: z.number().int(),
    previous_owner_id: z.number().int().nullish(),
  })
  .passthrough();

const sleeperDraftSchema = z
  .object({
    draft_id: z.string(),
    league_id: z.string().nullish(),
    season: z.string(),
    type: z.string().nullish(),
    status: z.string().nullish(),
    settings: z.record(z.string(), z.unknown()).nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const sleeperDraftPickSchema = z
  .object({
    pick_no: z.number().int(),
    round: z.number().int(),
    roster_id: z.number().int().nullish(),
    picked_by: z.string().nullish(),
    player_id: z.string().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

type SleeperPlayer = z.infer<typeof sleeperPlayerSchema>;
type SleeperLeague = z.infer<typeof sleeperLeagueSchema>;
type SleeperRoster = z.infer<typeof sleeperRosterSchema>;

function chunkArray<T>(items: T[], size = DEFAULT_WRITE_BATCH_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export class SleeperHttpError extends Error {
  readonly temporary: boolean;

  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SleeperHttpError";
    this.temporary = status === 429 || status >= 500;
  }
}

export class SleeperClient {
  private lastRequestAt = 0;

  constructor(
    private readonly options: {
      baseUrl?: string;
      fetcher?: SleeperFetch;
      minRequestIntervalMs?: number;
    } = {},
  ) {}

  private async waitForRateLimit() {
    const minInterval = this.options.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS;
    const elapsed = Date.now() - this.lastRequestAt;

    if (elapsed > 0 && elapsed < minInterval) {
      await new Promise((resolve) => setTimeout(resolve, minInterval - elapsed));
    }
  }

  private async get<T>(path: string, schema: z.ZodType<T>) {
    await this.waitForRateLimit();

    const baseUrl = this.options.baseUrl ?? env.SLEEPER_BASE_URL;
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(new URL(path, `${baseUrl.replace(/\/$/, "")}/`));
    this.lastRequestAt = Date.now();

    if (!response.ok) {
      throw new SleeperHttpError(`Sleeper request failed with HTTP ${response.status} for ${path}.`, response.status);
    }

    return schema.parse(await response.json());
  }

  getPlayers() {
    return this.get("players/nfl", sleeperPlayersResponseSchema);
  }

  getLeague(sleeperLeagueId: string) {
    return this.get(`league/${sleeperLeagueId}`, sleeperLeagueSchema);
  }

  getLeagueUsers(sleeperLeagueId: string) {
    return this.get(`league/${sleeperLeagueId}/users`, z.array(sleeperUserSchema));
  }

  getLeagueRosters(sleeperLeagueId: string) {
    return this.get(`league/${sleeperLeagueId}/rosters`, z.array(sleeperRosterSchema));
  }

  getMatchups(sleeperLeagueId: string, week: number) {
    return this.get(`league/${sleeperLeagueId}/matchups/${week}`, z.array(sleeperMatchupSchema));
  }

  getTransactions(sleeperLeagueId: string, week: number) {
    return this.get(`league/${sleeperLeagueId}/transactions/${week}`, z.array(sleeperTransactionSchema));
  }

  getTradedPicks(sleeperLeagueId: string) {
    return this.get(`league/${sleeperLeagueId}/traded_picks`, z.array(sleeperTradedPickSchema));
  }

  getDrafts(sleeperLeagueId: string) {
    return this.get(`league/${sleeperLeagueId}/drafts`, z.array(sleeperDraftSchema));
  }

  getDraftPicks(sleeperDraftId: string) {
    return this.get(`draft/${sleeperDraftId}/picks`, z.array(sleeperDraftPickSchema));
  }
}

export function getSleeperServiceStatus() {
  return {
    source: "sleeper" as const,
    baseUrl: env.SLEEPER_BASE_URL,
    mode: "read-only" as const,
  };
}

function normalizeSearchName(player: SleeperPlayer) {
  return (player.search_full_name ?? player.full_name ?? `${player.first_name ?? ""} ${player.last_name ?? ""}`)
    .trim()
    .toLowerCase();
}

function fullName(player: SleeperPlayer) {
  const fromNameParts = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
  return (player.full_name ?? (fromNameParts || player.player_id)).trim();
}

function numberFromSeason(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

function dateFromMs(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : null;
}

function rosterDbId(leagueId: string, rosterId: number) {
  return `${leagueId}:${rosterId}`;
}

function draftDbId(sleeperDraftId: string) {
  return `sleeper:${sleeperDraftId}`;
}

function transactionDbId(leagueId: string, sleeperTransactionId: string) {
  return `${leagueId}:${sleeperTransactionId}`;
}

function tradedPickDbId(leagueId: string, pick: z.infer<typeof sleeperTradedPickSchema>) {
  return `${leagueId}:${pick.season}:${pick.round}:${pick.roster_id}`;
}

function draftPickDbId(sleeperDraftId: string, pickNo: number) {
  return `${sleeperDraftId}:${pickNo}`;
}

function matchupWeeks(league: SleeperLeague, requestedWeek?: number | null) {
  if (requestedWeek) {
    return [requestedWeek];
  }

  const settings = league.settings ?? {};
  const configuredWeek =
    typeof settings.playoff_week_start === "number" ? settings.playoff_week_start - 1 : DEFAULT_WEEKS;
  const weekCount = Math.max(1, Math.min(23, configuredWeek || DEFAULT_WEEKS));
  return Array.from({ length: weekCount }, (_, index) => index + 1);
}

async function storeSnapshot(input: {
  sourceKey: string;
  leagueId?: string | null;
  season?: number | null;
  week?: number | null;
  payload: unknown;
}) {
  await db
    .insert(sourceSnapshots)
    .values({
      id: randomUUID(),
      source: "sleeper",
      sourceKey: input.sourceKey,
      leagueId: input.leagueId ?? null,
      season: input.season ?? null,
      week: input.week ?? null,
      payload: input.payload,
      capturedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [sourceSnapshots.source, sourceSnapshots.sourceKey],
      set: {
        leagueId: input.leagueId ?? null,
        season: input.season ?? null,
        week: input.week ?? null,
        payload: input.payload,
        capturedAt: new Date(),
      },
    });
}

async function appSettingDate(key: string) {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  const value = row?.value;

  if (typeof value !== "object" || value === null || !("importedAt" in value)) {
    return null;
  }

  const importedAt = new Date(String(value.importedAt));
  return Number.isNaN(importedAt.getTime()) ? null : importedAt;
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

async function ensurePlaceholderPlayers(playerIds: string[], timestamp: Date) {
  const uniqueIds = Array.from(new Set(playerIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return 0;
  }

  const existingRows = await db
    .select({ sleeperPlayerId: players.sleeperPlayerId })
    .from(players)
    .where(inArray(players.sleeperPlayerId, uniqueIds));
  const existing = new Set(existingRows.map((row) => row.sleeperPlayerId));
  const missing = uniqueIds.filter((id) => !existing.has(id));

  if (missing.length === 0) {
    return 0;
  }

  for (const batch of chunkArray(
    missing.map((id) => ({
      sleeperPlayerId: id,
      fullName: `Sleeper ${id}`,
      searchName: id.toLowerCase(),
      metadata: { placeholder: true },
      sourceUpdatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )) {
    await db.insert(players).values(batch);
  }

  return missing.length;
}

export async function importSleeperPlayers(client = new SleeperClient()): Promise<{
  counts: ImportCounts;
  warnings: string[];
}> {
  const lastImportedAt = await appSettingDate("sleeper.players.lastImportedAt");

  if (lastImportedAt && Date.now() - lastImportedAt.getTime() < DAY_MS) {
    return {
      counts: { playersSkipped: 1 },
      warnings: [],
    };
  }

  const timestamp = new Date();
  const response = await client.getPlayers();
  const rows = Object.values(response).filter((player) => player.player_id);

  await storeSnapshot({ sourceKey: "players:nfl", payload: response });

  if (rows.length > 0) {
    const playerValues = rows.map((player) => ({
      sleeperPlayerId: player.player_id,
      fullName: fullName(player),
      firstName: player.first_name ?? null,
      lastName: player.last_name ?? null,
      searchName: normalizeSearchName(player) || player.player_id.toLowerCase(),
      position: player.position ?? null,
      team: player.team ?? null,
      status: player.status ?? null,
      age: player.age ?? null,
      birthDate: player.birth_date ?? null,
      yearsExp: player.years_exp ?? null,
      fantasyPositions: player.fantasy_positions ?? null,
      metadata: player as JsonObject,
      sourceUpdatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    for (const batch of chunkArray(playerValues)) {
      await db
        .insert(players)
        .values(batch)
        .onConflictDoUpdate({
          target: players.sleeperPlayerId,
          set: {
            fullName: sql`excluded.full_name`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            searchName: sql`excluded.search_name`,
            position: sql`excluded.position`,
            team: sql`excluded.team`,
            status: sql`excluded.status`,
            age: sql`excluded.age`,
            birthDate: sql`excluded.birth_date`,
            yearsExp: sql`excluded.years_exp`,
            fantasyPositions: sql`excluded.fantasy_positions`,
            metadata: sql`excluded.metadata`,
            sourceUpdatedAt: timestamp,
            updatedAt: timestamp,
          },
        });
    }
  }

  await setAppSetting("sleeper.players.lastImportedAt", { importedAt: timestamp.toISOString() });

  return {
    counts: { playersImported: rows.length, snapshotsStored: 1 },
    warnings: [],
  };
}

async function upsertLeague(league: SleeperLeague, timestamp: Date) {
  const season = numberFromSeason(league.season);
  const id = `sleeper:${league.league_id}`;

  await db
    .insert(leagues)
    .values({
      id,
      sleeperLeagueId: league.league_id,
      name: league.name ?? `Sleeper league ${league.league_id}`,
      avatar: league.avatar ?? null,
      season,
      status: league.status ?? null,
      sport: league.sport ?? "nfl",
      scoringSettings: league.scoring_settings ?? null,
      rosterPositions: league.roster_positions ?? null,
      settings: league.settings ?? null,
      metadata: league.metadata ?? null,
      importedAt: timestamp,
      sourceUpdatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: leagues.sleeperLeagueId,
      set: {
        name: league.name ?? `Sleeper league ${league.league_id}`,
        avatar: league.avatar ?? null,
        season,
        status: league.status ?? null,
        sport: league.sport ?? "nfl",
        scoringSettings: league.scoring_settings ?? null,
        rosterPositions: league.roster_positions ?? null,
        settings: league.settings ?? null,
        metadata: league.metadata ?? null,
        importedAt: timestamp,
        sourceUpdatedAt: timestamp,
        updatedAt: timestamp,
      },
    });

  return { id, season };
}

async function importLeagueUsers(leagueId: string, sleeperLeagueId: string, client: SleeperClient, timestamp: Date) {
  const usersPayload = await client.getLeagueUsers(sleeperLeagueId);
  await storeSnapshot({ sourceKey: `league:${sleeperLeagueId}:users`, leagueId, payload: usersPayload });

  if (usersPayload.length > 0) {
    await db
      .insert(leagueUsers)
      .values(
        usersPayload.map((user) => ({
          leagueId,
          sleeperUserId: user.user_id,
          displayName: user.display_name ?? null,
          username: user.username ?? null,
          avatar: user.avatar ?? null,
          metadata: user.metadata ?? null,
          updatedAt: timestamp,
        })),
      )
      .onConflictDoUpdate({
        target: [leagueUsers.leagueId, leagueUsers.sleeperUserId],
        set: { updatedAt: timestamp },
      });

    for (const user of usersPayload) {
      await db
        .update(leagueUsers)
        .set({
          displayName: user.display_name ?? null,
          username: user.username ?? null,
          avatar: user.avatar ?? null,
          metadata: user.metadata ?? null,
          updatedAt: timestamp,
        })
        .where(and(eq(leagueUsers.leagueId, leagueId), eq(leagueUsers.sleeperUserId, user.user_id)));
    }
  }

  return usersPayload.length;
}

function rosterPlayerIds(rosterRows: SleeperRoster[]) {
  const ids = new Set<string>();

  for (const roster of rosterRows) {
    for (const playerId of [...(roster.players ?? []), ...(roster.starters ?? []), ...(roster.taxi ?? []), ...(roster.reserve ?? [])]) {
      ids.add(playerId);
    }
  }

  return Array.from(ids);
}

async function importRosters(leagueId: string, sleeperLeagueId: string, client: SleeperClient, timestamp: Date) {
  const rostersPayload = await client.getLeagueRosters(sleeperLeagueId);
  await storeSnapshot({ sourceKey: `league:${sleeperLeagueId}:rosters`, leagueId, payload: rostersPayload });
  const placeholders = await ensurePlaceholderPlayers(rosterPlayerIds(rostersPayload), timestamp);

  if (rostersPayload.length > 0) {
    await db
      .insert(rosters)
      .values(
        rostersPayload.map((roster) => ({
          id: rosterDbId(leagueId, roster.roster_id),
          leagueId,
          rosterId: roster.roster_id,
          ownerSleeperUserId: roster.owner_id ?? null,
          coOwners: roster.co_owners ?? null,
          settings: roster.settings ?? null,
          metadata: roster.metadata ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      )
      .onConflictDoUpdate({
        target: [rosters.leagueId, rosters.rosterId],
        set: { updatedAt: timestamp },
      });

    for (const roster of rostersPayload) {
      await db
        .update(rosters)
        .set({
          ownerSleeperUserId: roster.owner_id ?? null,
          coOwners: roster.co_owners ?? null,
          settings: roster.settings ?? null,
          metadata: roster.metadata ?? null,
          updatedAt: timestamp,
        })
        .where(and(eq(rosters.leagueId, leagueId), eq(rosters.rosterId, roster.roster_id)));
    }

    await db.delete(rosterPlayers).where(eq(rosterPlayers.leagueId, leagueId));

    const rosterPlayerRows = rostersPayload.flatMap((roster) => {
      const starters = new Set(roster.starters ?? []);
      const taxi = new Set(roster.taxi ?? []);
      const reserve = new Set(roster.reserve ?? []);
      const rostered = new Set(roster.players ?? []);

      return Array.from(new Set([...rostered, ...starters, ...taxi, ...reserve])).flatMap((sleeperPlayerId) => {
        const slots: Array<"roster" | "starter" | "taxi" | "reserve"> = [];
        if (rostered.has(sleeperPlayerId)) slots.push("roster");
        if (starters.has(sleeperPlayerId)) slots.push("starter");
        if (taxi.has(sleeperPlayerId)) slots.push("taxi");
        if (reserve.has(sleeperPlayerId)) slots.push("reserve");

        return slots.map((slot) => ({
          leagueId,
          rosterId: roster.roster_id,
          sleeperPlayerId,
          slot,
          createdAt: timestamp,
          updatedAt: timestamp,
        }));
      });
    });

    if (rosterPlayerRows.length > 0) {
      for (const batch of chunkArray(rosterPlayerRows)) {
        await db.insert(rosterPlayers).values(batch);
      }
    }

    return {
      rostersImported: rostersPayload.length,
      rosterPlayersImported: rosterPlayerRows.length,
      placeholderPlayersCreated: placeholders,
    };
  }

  return { rostersImported: 0, rosterPlayersImported: 0, placeholderPlayersCreated: placeholders };
}

async function importWeeklyLeagueData(input: {
  league: SleeperLeague;
  leagueId: string;
  sleeperLeagueId: string;
  season: number;
  week?: number | null;
  client: SleeperClient;
  timestamp: Date;
}) {
  let matchupCount = 0;
  let transactionCount = 0;

  for (const week of matchupWeeks(input.league, input.week)) {
    const matchupsPayload = await input.client.getMatchups(input.sleeperLeagueId, week);
    const transactionsPayload = await input.client.getTransactions(input.sleeperLeagueId, week);

    await storeSnapshot({
      sourceKey: `league:${input.sleeperLeagueId}:matchups:${week}`,
      leagueId: input.leagueId,
      season: input.season,
      week,
      payload: matchupsPayload,
    });
    await storeSnapshot({
      sourceKey: `league:${input.sleeperLeagueId}:transactions:${week}`,
      leagueId: input.leagueId,
      season: input.season,
      week,
      payload: transactionsPayload,
    });

    if (matchupsPayload.length > 0) {
      await db.delete(matchups).where(
        and(
          eq(matchups.leagueId, input.leagueId),
          eq(matchups.season, input.season),
          eq(matchups.week, week),
        ),
      );
      await db.insert(matchups).values(
        matchupsPayload.map((matchup) => ({
          leagueId: input.leagueId,
          season: input.season,
          week,
          rosterId: matchup.roster_id,
          matchupId: matchup.matchup_id ?? null,
          points: matchup.points ?? null,
          starters: matchup.starters ?? null,
          players: matchup.players ?? null,
          playerPoints: matchup.players_points ?? null,
          sourceUpdatedAt: input.timestamp,
        })),
      );
      matchupCount += matchupsPayload.length;
    }

    if (transactionsPayload.length > 0) {
      await db
        .insert(transactions)
        .values(
          transactionsPayload.map((transaction) => ({
            id: transactionDbId(input.leagueId, transaction.transaction_id),
            leagueId: input.leagueId,
            sleeperTransactionId: transaction.transaction_id,
            type: transaction.type,
            status: transaction.status ?? null,
            rosterIds: transaction.roster_ids ?? null,
            adds: transaction.adds ?? null,
            drops: transaction.drops ?? null,
            draftPicks: transaction.draft_picks ?? null,
            waiverBudget: transaction.waiver_budget ?? null,
            createdAtMs: dateFromMs(transaction.created) ?? dateFromMs(transaction.status_updated),
            metadata: transaction.metadata ?? null,
            sourceUpdatedAt: input.timestamp,
          })),
        )
        .onConflictDoUpdate({
          target: [transactions.leagueId, transactions.sleeperTransactionId],
          set: { sourceUpdatedAt: input.timestamp },
        });

      for (const transaction of transactionsPayload) {
        await db
          .update(transactions)
          .set({
            type: transaction.type,
            status: transaction.status ?? null,
            rosterIds: transaction.roster_ids ?? null,
            adds: transaction.adds ?? null,
            drops: transaction.drops ?? null,
            draftPicks: transaction.draft_picks ?? null,
            waiverBudget: transaction.waiver_budget ?? null,
            createdAtMs: dateFromMs(transaction.created) ?? dateFromMs(transaction.status_updated),
            metadata: transaction.metadata ?? null,
            sourceUpdatedAt: input.timestamp,
          })
          .where(
            and(
              eq(transactions.leagueId, input.leagueId),
              eq(transactions.sleeperTransactionId, transaction.transaction_id),
            ),
          );
      }

      transactionCount += transactionsPayload.length;
    }
  }

  return {
    matchupsImported: matchupCount,
    transactionsImported: transactionCount,
  };
}

async function importTradedPicks(input: {
  leagueId: string;
  sleeperLeagueId: string;
  client: SleeperClient;
  timestamp: Date;
}) {
  const picksPayload = await input.client.getTradedPicks(input.sleeperLeagueId);
  await storeSnapshot({
    sourceKey: `league:${input.sleeperLeagueId}:traded-picks`,
    leagueId: input.leagueId,
    payload: picksPayload,
  });

  if (picksPayload.length === 0) {
    return 0;
  }

  await db
    .insert(tradedPicks)
    .values(
      picksPayload.map((pick) => ({
        id: tradedPickDbId(input.leagueId, pick),
        leagueId: input.leagueId,
        season: numberFromSeason(pick.season),
        round: pick.round,
        rosterId: pick.roster_id,
        ownerRosterId: pick.owner_id,
        previousOwnerRosterId: pick.previous_owner_id ?? null,
        sourceUpdatedAt: input.timestamp,
      })),
    )
    .onConflictDoUpdate({
      target: [tradedPicks.leagueId, tradedPicks.season, tradedPicks.round, tradedPicks.rosterId],
      set: { sourceUpdatedAt: input.timestamp },
    });

  for (const pick of picksPayload) {
    await db
      .update(tradedPicks)
      .set({
        ownerRosterId: pick.owner_id,
        previousOwnerRosterId: pick.previous_owner_id ?? null,
        sourceUpdatedAt: input.timestamp,
      })
      .where(
        and(
          eq(tradedPicks.leagueId, input.leagueId),
          eq(tradedPicks.season, numberFromSeason(pick.season)),
          eq(tradedPicks.round, pick.round),
          eq(tradedPicks.rosterId, pick.roster_id),
        ),
      );
  }

  return picksPayload.length;
}

async function importDrafts(input: {
  leagueId: string;
  sleeperLeagueId: string;
  client: SleeperClient;
  timestamp: Date;
}) {
  const draftsPayload = await input.client.getDrafts(input.sleeperLeagueId);
  await storeSnapshot({
    sourceKey: `league:${input.sleeperLeagueId}:drafts`,
    leagueId: input.leagueId,
    payload: draftsPayload,
  });

  let picksImported = 0;
  let placeholderPlayersCreated = 0;

  if (draftsPayload.length > 0) {
    await db
      .insert(drafts)
      .values(
        draftsPayload.map((draft) => ({
          id: draftDbId(draft.draft_id),
          leagueId: input.leagueId,
          sleeperDraftId: draft.draft_id,
          season: numberFromSeason(draft.season),
          type: draft.type ?? null,
          status: draft.status ?? null,
          settings: draft.settings ?? null,
          metadata: draft.metadata ?? null,
          sourceUpdatedAt: input.timestamp,
          createdAt: input.timestamp,
          updatedAt: input.timestamp,
        })),
      )
      .onConflictDoUpdate({
        target: drafts.sleeperDraftId,
        set: { updatedAt: input.timestamp, sourceUpdatedAt: input.timestamp },
      });

    for (const draft of draftsPayload) {
      await db
        .update(drafts)
        .set({
          leagueId: input.leagueId,
          season: numberFromSeason(draft.season),
          type: draft.type ?? null,
          status: draft.status ?? null,
          settings: draft.settings ?? null,
          metadata: draft.metadata ?? null,
          sourceUpdatedAt: input.timestamp,
          updatedAt: input.timestamp,
        })
        .where(eq(drafts.sleeperDraftId, draft.draft_id));

      const picksPayload = await input.client.getDraftPicks(draft.draft_id);
      await storeSnapshot({
        sourceKey: `draft:${draft.draft_id}:picks`,
        leagueId: input.leagueId,
        season: numberFromSeason(draft.season),
        payload: picksPayload,
      });
      placeholderPlayersCreated += await ensurePlaceholderPlayers(
        picksPayload.flatMap((pick) => (pick.player_id ? [pick.player_id] : [])),
        input.timestamp,
      );

      if (picksPayload.length > 0) {
        await db
          .insert(draftPicks)
          .values(
            picksPayload.map((pick) => ({
              id: draftPickDbId(draft.draft_id, pick.pick_no),
              draftId: draftDbId(draft.draft_id),
              leagueId: input.leagueId,
              season: numberFromSeason(draft.season),
              round: pick.round,
              pickNo: pick.pick_no,
              rosterId: pick.roster_id ?? null,
              pickedByRosterId: pick.picked_by ? Number(pick.picked_by) : null,
              sleeperPlayerId: pick.player_id ?? null,
              metadata: pick.metadata ?? null,
              sourceUpdatedAt: input.timestamp,
            })),
          )
          .onConflictDoUpdate({
            target: [draftPicks.draftId, draftPicks.pickNo],
            set: { sourceUpdatedAt: input.timestamp },
          });

        for (const pick of picksPayload) {
          await db
            .update(draftPicks)
            .set({
              leagueId: input.leagueId,
              season: numberFromSeason(draft.season),
              round: pick.round,
              rosterId: pick.roster_id ?? null,
              pickedByRosterId: pick.picked_by ? Number(pick.picked_by) : null,
              sleeperPlayerId: pick.player_id ?? null,
              metadata: pick.metadata ?? null,
              sourceUpdatedAt: input.timestamp,
            })
            .where(and(eq(draftPicks.draftId, draftDbId(draft.draft_id)), eq(draftPicks.pickNo, pick.pick_no)));
        }

        picksImported += picksPayload.length;
      }
    }
  }

  return {
    draftsImported: draftsPayload.length,
    draftPicksImported: picksImported,
    placeholderPlayersCreated,
  };
}

async function resolveSleeperLeagueId(job: ImportJob) {
  const metadata = (job.metadata ?? {}) as Record<string, unknown>;
  const metadataLeagueId = typeof metadata.sleeperLeagueId === "string" ? metadata.sleeperLeagueId : null;

  if (metadataLeagueId) {
    return metadataLeagueId;
  }

  if (!job.leagueId) {
    return null;
  }

  const row = await db.query.leagues.findFirst({ where: eq(leagues.id, job.leagueId) });
  return row?.sleeperLeagueId ?? null;
}

export async function importSleeperLeague(
  job: ImportJob,
  client = new SleeperClient(),
): Promise<{ counts: ImportCounts; warnings: string[]; metadata: Record<string, unknown> }> {
  const sleeperLeagueId = await resolveSleeperLeagueId(job);

  if (!sleeperLeagueId) {
    throw new Error("Sleeper league import requires a sleeperLeagueId in metadata or a linked leagueId.");
  }

  const timestamp = new Date();
  const league = await client.getLeague(sleeperLeagueId);
  const { id: leagueId, season } = await upsertLeague(league, timestamp);
  await storeSnapshot({ sourceKey: `league:${sleeperLeagueId}`, leagueId, season, payload: league });

  const usersImported = await importLeagueUsers(leagueId, sleeperLeagueId, client, timestamp);
  const rosterCounts = await importRosters(leagueId, sleeperLeagueId, client, timestamp);
  const weeklyCounts = await importWeeklyLeagueData({
    league,
    leagueId,
    sleeperLeagueId,
    season,
    week: job.week,
    client,
    timestamp,
  });
  const tradedPicksImported = await importTradedPicks({ leagueId, sleeperLeagueId, client, timestamp });
  const draftCounts = await importDrafts({ leagueId, sleeperLeagueId, client, timestamp });

  return {
    counts: {
      leaguesImported: 1,
      leagueUsersImported: usersImported,
      ...rosterCounts,
      ...weeklyCounts,
      tradedPicksImported,
      ...draftCounts,
      placeholderPlayersCreated:
        rosterCounts.placeholderPlayersCreated + draftCounts.placeholderPlayersCreated,
    },
    warnings: [],
    metadata: {
      sleeperLeagueId,
      leagueId,
      readOnly: true,
    },
  };
}

export async function importSleeperJob(job: ImportJob) {
  const client = new SleeperClient();
  const counts: ImportCounts = {};
  const warnings: string[] = [];
  const metadata: Record<string, unknown> = { readOnly: true };
  const jobMetadata = (job.metadata ?? {}) as Record<string, unknown>;
  const hasLeagueTarget = Boolean(job.leagueId || typeof jobMetadata.sleeperLeagueId === "string");

  if (job.scope === "players" || job.scope === "full" || job.scope == null) {
    const result = await importSleeperPlayers(client);
    Object.assign(counts, result.counts);
    warnings.push(...result.warnings);
  }

  if (job.scope === "league" || job.scope === "league-link" || (job.scope === "full" && hasLeagueTarget)) {
    const result = await importSleeperLeague(job, client);
    Object.assign(counts, result.counts);
    warnings.push(...result.warnings);
    Object.assign(metadata, result.metadata);
  } else if (job.scope === "full" && !hasLeagueTarget) {
    warnings.push("Sleeper full import skipped league ingestion because no Sleeper league ID was provided.");
  }

  if (Object.keys(counts).length === 0) {
    counts.unitsSkipped = 1;
    metadata.note = `Sleeper scope "${job.scope}" did not match a runnable importer.`;
  }

  return {
    counts,
    warnings,
    metadata,
  };
}
