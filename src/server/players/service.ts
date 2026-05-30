import "server-only";

import { and, asc, desc, eq, gte, inArray, like, lte, ne, or, sql, type SQL } from "drizzle-orm";

import type { PlayerListQuery } from "@/contracts/players";
import { db } from "@/server/db/client";
import {
  leagueUsers,
  leagues,
  players,
  playerSourceIds,
  rosterPlayers,
  rosters,
  seasonStats,
  userLeagueTeams,
  weeklyStats,
} from "@/server/db/schema";
import { ApiError } from "@/server/api/errors";
import { cachedPlayerImageIds, espnIdFromMetadata, localPlayerImageUrl } from "@/server/players/images";

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

type PlayerRow = typeof players.$inferSelect;
type RosterExposure = {
  rosteredCount: number;
  leagueCount: number;
  labels: string[];
};
type SeasonSummary = {
  season: number;
  games: number | null;
  fantasyPoints: number | null;
  fantasyPointsPpr: number | null;
  fantasyPointsPerGame: number | null;
  scoringLabel: string;
  keyStats: {
    passingYards: number | null;
    passingTds: number | null;
    rushingYards: number | null;
    rushingTds: number | null;
    receptions: number | null;
    receivingYards: number | null;
    receivingTds: number | null;
  };
};
type TrendPoint = {
  week: number;
  fantasyPoints: number | null;
  fantasyPointsPpr: number | null;
};
type DraftInfo = {
  year: number;
  round: number;
  pick: number;
};
type ScoringMode = {
  value: 0 | 0.5 | 1;
  label: string;
};

const scoringLabels: Record<ScoringMode["value"], string> = {
  0: "Standard",
  0.5: "Half PPR",
  1: "Full PPR",
};

function numberStat(stats: Record<string, number | string | null> | null, key: string) {
  const value = stats?.[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function keyStats(stats: Record<string, number | string | null> | null) {
  return {
    passingYards: numberStat(stats, "passing_yards"),
    passingTds: numberStat(stats, "passing_tds"),
    rushingYards: numberStat(stats, "rushing_yards"),
    rushingTds: numberStat(stats, "rushing_tds"),
    receptions: numberStat(stats, "receptions"),
    receivingYards: numberStat(stats, "receiving_yards"),
    receivingTds: numberStat(stats, "receiving_tds"),
  };
}

function integerMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  const parsed = typeof value === "string" ? Number(value) : value;

  return typeof parsed === "number" && Number.isInteger(parsed) ? parsed : null;
}

export function draftInfoFromMetadata(metadata: Record<string, unknown> | null | undefined): DraftInfo | null {
  const year = integerMetadataValue(metadata, "draft_year");
  const round = integerMetadataValue(metadata, "draft_round");
  const pick = integerMetadataValue(metadata, "draft_pick");

  if (year == null || round == null || pick == null) {
    return null;
  }

  return { year, round, pick };
}

function normalizeScoringValue(value: unknown): ScoringMode["value"] | null {
  const parsed = typeof value === "string" ? Number(value) : value;

  if (parsed === 0 || parsed === 0.5 || parsed === 1) {
    return parsed;
  }

  return null;
}

function scoringMode(value: ScoringMode["value"]): ScoringMode {
  return {
    value,
    label: scoringLabels[value],
  };
}

function fantasyPointsForScoring(
  row: {
    fantasyPointsStandard: number | null;
    fantasyPointsHalfPpr: number | null;
    fantasyPointsPpr: number | null;
  },
  scoring: ScoringMode,
) {
  switch (scoring.value) {
    case 0:
      return row.fantasyPointsStandard;
    case 0.5:
      return row.fantasyPointsHalfPpr;
    case 1:
    default:
      return row.fantasyPointsPpr;
  }
}

async function scoringForLeague(leagueId: string | undefined, userId: string): Promise<ScoringMode> {
  if (!leagueId) {
    return scoringMode(1);
  }

  const [row] = await db
    .select({
      scoringSettings: leagues.scoringSettings,
      pprScoringPreference: userLeagueTeams.pprScoringPreference,
    })
    .from(leagues)
    .innerJoin(userLeagueTeams, and(eq(userLeagueTeams.leagueId, leagues.id), eq(userLeagueTeams.userId, userId)))
    .where(eq(leagues.id, leagueId))
    .limit(1);

  const sleeperValue = normalizeScoringValue(row?.scoringSettings?.rec);
  const profileValue = normalizeScoringValue(row?.pprScoringPreference);

  return scoringMode(sleeperValue ?? profileValue ?? 1);
}

function playerBadges(input: { row: PlayerRow; exposure: RosterExposure; summary: SeasonSummary | null }) {
  const badges: string[] = [];
  const status = input.row.status?.toLowerCase();

  if (input.exposure.rosteredCount > 0) {
    badges.push("rostered");
  } else {
    badges.push("free agent");
  }

  if (status && status !== "active") {
    badges.push(input.row.status ?? "status");
  }

  if (input.row.yearsExp === 0) {
    badges.push("rookie");
  }

  if ((input.summary?.fantasyPointsPerGame ?? 0) >= 15) {
    badges.push("production");
  }

  return badges;
}

function mapPlayer(input: {
  row: PlayerRow;
  exposure: RosterExposure;
  summary: SeasonSummary | null;
  trend: TrendPoint[];
  draftInfo: DraftInfo | null;
  cachedImageIds: Set<string>;
}) {
  const espnId = espnIdFromMetadata(input.row.metadata);

  return {
    sleeperPlayerId: input.row.sleeperPlayerId,
    fullName: input.row.fullName,
    firstName: input.row.firstName,
    lastName: input.row.lastName,
    position: input.row.position,
    team: input.row.team,
    status: input.row.status,
    age: input.row.age,
    fantasyPositions: input.row.fantasyPositions,
    imageUrl: espnId && input.cachedImageIds.has(espnId) ? localPlayerImageUrl(espnId) : null,
    rosterExposure: input.exposure,
    seasonSummary: input.summary,
    trend: input.trend,
    draftInfo: input.draftInfo,
    badges: playerBadges(input),
    sourceUpdatedAt: toIso(input.row.sourceUpdatedAt),
    updatedAt: input.row.updatedAt.toISOString(),
  };
}

export function playerSearchTerms(query: string) {
  const normalized = query.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const spaced = normalized.replace(/[^a-z0-9]+/g, " ").trim();

  return Array.from(new Set([normalized, spaced, compact].filter(Boolean)));
}

function playerWhere(query: PlayerListQuery) {
  const filters: SQL[] = [];

  if (query.q) {
    const searchFilters = playerSearchTerms(query.q).map((term) => like(players.searchName, `%${term}%`));
    if (searchFilters.length > 0) {
      filters.push(or(...searchFilters)!);
    }
  }

  if (query.position) {
    filters.push(eq(players.position, query.position.toUpperCase()));
  }

  if (query.team) {
    filters.push(eq(players.team, query.team.toUpperCase()));
  }

  if (query.status) {
    filters.push(eq(players.status, query.status));
  }

  if (query.injured) {
    filters.push(ne(players.status, "Active"));
  }

  if (query.ageMin != null) {
    filters.push(gte(players.age, query.ageMin));
  }

  if (query.ageMax != null) {
    filters.push(lte(players.age, query.ageMax));
  }

  if (query.fantasyRelevant) {
    filters.push(inArray(players.position, Array.from(FANTASY_POSITIONS)));
  }

  return filters.length ? and(...filters) : undefined;
}

function basePlayerOrder(query: PlayerListQuery) {
  const direction = query.dir === "desc" ? desc : asc;

  switch (query.sort) {
    case "age":
      return direction(players.age);
    case "position":
      return direction(players.position);
    case "team":
      return direction(players.team);
    case "updated":
      return direction(players.updatedAt);
    case "production":
    case "exposure":
    case "name":
    default:
      return direction(players.fullName);
  }
}

type PlayerDto = ReturnType<typeof mapPlayer>;

function sortMappedPlayers<TPlayer extends PlayerDto>(items: TPlayer[], query: PlayerListQuery) {
  const multiplier = query.dir === "desc" ? -1 : 1;

  return [...items].sort((left, right) => {
    switch (query.sort) {
      case "production":
        return (
          ((left.seasonSummary?.fantasyPoints ?? -1) - (right.seasonSummary?.fantasyPoints ?? -1)) * multiplier ||
          left.fullName.localeCompare(right.fullName)
        );
      case "exposure":
        return (
          (left.rosterExposure.rosteredCount - right.rosterExposure.rosteredCount) * multiplier ||
          left.fullName.localeCompare(right.fullName)
        );
      case "age":
        return ((left.age ?? 999) - (right.age ?? 999)) * multiplier || left.fullName.localeCompare(right.fullName);
      case "position":
        return (left.position ?? "").localeCompare(right.position ?? "") * multiplier || left.fullName.localeCompare(right.fullName);
      case "team":
        return (left.team ?? "").localeCompare(right.team ?? "") * multiplier || left.fullName.localeCompare(right.fullName);
      case "updated":
        return left.updatedAt.localeCompare(right.updatedAt) * multiplier || left.fullName.localeCompare(right.fullName);
      case "name":
      default:
        return left.fullName.localeCompare(right.fullName) * multiplier;
    }
  });
}

async function enrichPlayers(rows: PlayerRow[], userId: string, leagueId: string | undefined, query: PlayerListQuery, scoring: ScoringMode) {
  const playerIds = rows.map((row) => row.sleeperPlayerId);
  const exposureMap = new Map<string, RosterExposure>();
  const seasonMap = new Map<string, SeasonSummary>();
  const trendMap = new Map<string, TrendPoint[]>();
  const draftInfoMap = new Map<string, DraftInfo>();
  const cachedImageIds = await cachedPlayerImageIds();

  for (const row of rows) {
    exposureMap.set(row.sleeperPlayerId, { rosteredCount: 0, leagueCount: 0, labels: [] });
    trendMap.set(row.sleeperPlayerId, []);
  }

  if (playerIds.length === 0) {
    return [];
  }

  const exposureFilters: SQL[] = [inArray(rosterPlayers.sleeperPlayerId, playerIds), eq(rosterPlayers.slot, "roster")];

  if (leagueId) {
    exposureFilters.push(eq(rosterPlayers.leagueId, leagueId));
  }

  const exposureRows = await db
    .select({
      sleeperPlayerId: rosterPlayers.sleeperPlayerId,
      leagueId: rosterPlayers.leagueId,
      rosterId: rosterPlayers.rosterId,
      leagueName: leagues.name,
      ownerName: leagueUsers.displayName,
      username: leagueUsers.username,
    })
    .from(rosterPlayers)
    .innerJoin(
      userLeagueTeams,
      and(eq(userLeagueTeams.leagueId, rosterPlayers.leagueId), eq(userLeagueTeams.userId, userId)),
    )
    .leftJoin(leagues, eq(rosterPlayers.leagueId, leagues.id))
    .leftJoin(rosters, and(eq(rosterPlayers.leagueId, rosters.leagueId), eq(rosterPlayers.rosterId, rosters.rosterId)))
    .leftJoin(leagueUsers, and(eq(rosters.leagueId, leagueUsers.leagueId), eq(rosters.ownerSleeperUserId, leagueUsers.sleeperUserId)))
    .where(and(...exposureFilters));

  const exposureKeys = new Set<string>();
  const leagueKeys = new Map<string, Set<string>>();

  for (const row of exposureRows) {
    const exposure = exposureMap.get(row.sleeperPlayerId);

    if (!exposure) {
      continue;
    }

    const key = `${row.sleeperPlayerId}:${row.leagueId}:${row.rosterId}`;
    if (!exposureKeys.has(key)) {
      exposure.rosteredCount += 1;
      exposureKeys.add(key);
    }

    const leaguesForPlayer = leagueKeys.get(row.sleeperPlayerId) ?? new Set<string>();
    leaguesForPlayer.add(row.leagueId);
    leagueKeys.set(row.sleeperPlayerId, leaguesForPlayer);

    const label = row.ownerName ?? row.username ?? row.leagueName ?? `Roster ${row.rosterId}`;
    if (!exposure.labels.includes(label)) {
      exposure.labels.push(label);
    }
  }

  for (const [sleeperPlayerId, leaguesForPlayer] of leagueKeys) {
    const exposure = exposureMap.get(sleeperPlayerId);
    if (exposure) {
      exposure.leagueCount = leaguesForPlayer.size;
      exposure.labels = exposure.labels.slice(0, 3);
    }
  }

  const seasonFilters: SQL[] = [inArray(seasonStats.sleeperPlayerId, playerIds)];
  const selectedSeason = query.season ?? null;
  if (selectedSeason) {
    seasonFilters.push(eq(seasonStats.season, selectedSeason));
  }

  const seasonRows = await db
    .select()
    .from(seasonStats)
    .where(and(...seasonFilters))
    .orderBy(desc(seasonStats.season));

  for (const row of seasonRows) {
    if (!row.sleeperPlayerId || seasonMap.has(row.sleeperPlayerId)) {
      continue;
    }

    const fantasyPoints = fantasyPointsForScoring(row, scoring);

    seasonMap.set(row.sleeperPlayerId, {
      season: row.season,
      games: row.games,
      fantasyPoints,
      fantasyPointsPpr: row.fantasyPointsPpr,
      fantasyPointsPerGame:
        fantasyPoints != null && row.games && row.games > 0
          ? Math.round((fantasyPoints / row.games) * 10) / 10
          : null,
      scoringLabel: scoring.label,
      keyStats: keyStats(row.stats),
    });
  }

  const trendFilters: SQL[] = [inArray(weeklyStats.sleeperPlayerId, playerIds)];
  if (selectedSeason) {
    trendFilters.push(eq(weeklyStats.season, selectedSeason));
  }

  const trendRows = await db
    .select({
      sleeperPlayerId: weeklyStats.sleeperPlayerId,
      season: weeklyStats.season,
      week: weeklyStats.week,
      fantasyPointsStandard: weeklyStats.fantasyPointsStandard,
      fantasyPointsHalfPpr: weeklyStats.fantasyPointsHalfPpr,
      fantasyPointsPpr: weeklyStats.fantasyPointsPpr,
    })
    .from(weeklyStats)
    .where(and(...trendFilters))
    .orderBy(desc(weeklyStats.season), desc(weeklyStats.week));

  for (const row of trendRows) {
    if (!row.sleeperPlayerId) {
      continue;
    }

    const trend = trendMap.get(row.sleeperPlayerId) ?? [];
    if (trend.length < 5) {
      trend.push({
        week: row.week,
        fantasyPoints: fantasyPointsForScoring(row, scoring),
        fantasyPointsPpr: row.fantasyPointsPpr,
      });
      trendMap.set(row.sleeperPlayerId, trend);
    }
  }

  const sourceRows = await db
    .select({
      sleeperPlayerId: playerSourceIds.sleeperPlayerId,
      metadata: playerSourceIds.metadata,
    })
    .from(playerSourceIds)
    .where(and(eq(playerSourceIds.source, "gsis"), inArray(playerSourceIds.sleeperPlayerId, playerIds)));

  for (const row of sourceRows) {
    const draftInfo = draftInfoFromMetadata(row.metadata);
    if (draftInfo) {
      draftInfoMap.set(row.sleeperPlayerId, draftInfo);
    }
  }

  return rows.map((row) =>
    mapPlayer({
      row,
      exposure: exposureMap.get(row.sleeperPlayerId) ?? { rosteredCount: 0, leagueCount: 0, labels: [] },
      summary: seasonMap.get(row.sleeperPlayerId) ?? null,
      trend: [...(trendMap.get(row.sleeperPlayerId) ?? [])].reverse(),
      draftInfo: draftInfoMap.get(row.sleeperPlayerId) ?? null,
      cachedImageIds,
    }),
  );
}

export async function listPlayers(query: PlayerListQuery, userId: string) {
  const scoring = await scoringForLeague(query.leagueId, userId);
  const availableSeasons = await listAvailableSeasons();
  const selectedSeason = query.season ?? availableSeasons[0] ?? null;
  const resolvedQuery = selectedSeason ? { ...query, season: selectedSeason } : query;
  let rosterPlayerIds: string[] | null = null;
  let seasonPlayerIds: string[] | null = null;

  if (resolvedQuery.leagueId && resolvedQuery.rosterId) {
    const rosterRows = await db
      .select({ sleeperPlayerId: rosterPlayers.sleeperPlayerId })
      .from(rosterPlayers)
      .innerJoin(userLeagueTeams, and(eq(userLeagueTeams.leagueId, rosterPlayers.leagueId), eq(userLeagueTeams.userId, userId)))
      .where(
        and(
          eq(rosterPlayers.leagueId, resolvedQuery.leagueId),
          eq(rosterPlayers.rosterId, resolvedQuery.rosterId),
          eq(rosterPlayers.slot, "roster"),
        ),
      );
    rosterPlayerIds = rosterRows.map((row) => row.sleeperPlayerId);
  }

  if (selectedSeason) {
    const seasonRows = await db
      .select({ sleeperPlayerId: seasonStats.sleeperPlayerId })
      .from(seasonStats)
      .where(eq(seasonStats.season, selectedSeason));
    seasonPlayerIds = seasonRows.flatMap((row) => (row.sleeperPlayerId ? [row.sleeperPlayerId] : []));
  }

  const baseWhere = playerWhere(resolvedQuery);
  const filters = [baseWhere].filter(Boolean) as SQL[];

  if (rosterPlayerIds != null) {
    filters.push(rosterPlayerIds.length > 0 ? inArray(players.sleeperPlayerId, rosterPlayerIds) : sql`0 = 1`);
  }

  if (seasonPlayerIds != null) {
    filters.push(seasonPlayerIds.length > 0 ? inArray(players.sleeperPlayerId, seasonPlayerIds) : sql`0 = 1`);
  }

  const where = filters.length > 0 ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const rows = await db
    .select()
    .from(players)
    .where(where)
    .orderBy(basePlayerOrder(resolvedQuery));
  const enrichedRows = await enrichPlayers(rows, userId, resolvedQuery.leagueId, resolvedQuery, scoring);
  const filteredRows = resolvedQuery.rostered
    ? enrichedRows.filter((row) => row.rosterExposure.rosteredCount > 0)
    : enrichedRows;
  const sortedRows = sortMappedPlayers(filteredRows, resolvedQuery);
  const paginatedRows = sortedRows.slice(offset, offset + resolvedQuery.pageSize);

  const total = sortedRows.length;

  return {
    items: paginatedRows,
    availableSeasons,
    selectedSeason,
    scoring,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    },
  };
}

async function listAvailableSeasons() {
  const rows = await db.select({ season: seasonStats.season }).from(seasonStats).groupBy(seasonStats.season).orderBy(desc(seasonStats.season));
  return rows.map((row) => row.season);
}

export async function getPlayerById(sleeperPlayerId: string, userId: string) {
  const row = await db.query.players.findFirst({
    where: eq(players.sleeperPlayerId, sleeperPlayerId),
  });

  if (!row) {
    throw new ApiError("NOT_FOUND", "Player not found.");
  }

  const scoring = await scoringForLeague(undefined, userId);
  const [enriched] = await enrichPlayers([row], userId, undefined, { page: 1, pageSize: 1, sort: "name", dir: "asc" }, scoring);
  return enriched;
}
