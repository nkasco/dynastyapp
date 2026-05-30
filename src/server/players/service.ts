import "server-only";

import { and, asc, desc, eq, gte, inArray, like, lte, ne, or, type SQL } from "drizzle-orm";

import type { PlayerListQuery } from "@/contracts/players";
import { db } from "@/server/db/client";
import {
  leagueUsers,
  leagues,
  players,
  rosterPlayers,
  rosters,
  seasonStats,
  userLeagueTeams,
  weeklyStats,
} from "@/server/db/schema";
import { ApiError } from "@/server/api/errors";

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
  fantasyPointsPpr: number | null;
  fantasyPointsPerGame: number | null;
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
  fantasyPointsPpr: number | null;
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
}) {
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
    rosterExposure: input.exposure,
    seasonSummary: input.summary,
    trend: input.trend,
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
          ((left.seasonSummary?.fantasyPointsPpr ?? -1) - (right.seasonSummary?.fantasyPointsPpr ?? -1)) * multiplier ||
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

async function enrichPlayers(rows: PlayerRow[], userId: string) {
  const playerIds = rows.map((row) => row.sleeperPlayerId);
  const exposureMap = new Map<string, RosterExposure>();
  const seasonMap = new Map<string, SeasonSummary>();
  const trendMap = new Map<string, TrendPoint[]>();

  for (const row of rows) {
    exposureMap.set(row.sleeperPlayerId, { rosteredCount: 0, leagueCount: 0, labels: [] });
    trendMap.set(row.sleeperPlayerId, []);
  }

  if (playerIds.length === 0) {
    return [];
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
    .where(and(inArray(rosterPlayers.sleeperPlayerId, playerIds), eq(rosterPlayers.slot, "roster")));

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

  const seasonRows = await db
    .select()
    .from(seasonStats)
    .where(inArray(seasonStats.sleeperPlayerId, playerIds))
    .orderBy(desc(seasonStats.season));

  for (const row of seasonRows) {
    if (!row.sleeperPlayerId || seasonMap.has(row.sleeperPlayerId)) {
      continue;
    }

    seasonMap.set(row.sleeperPlayerId, {
      season: row.season,
      games: row.games,
      fantasyPointsPpr: row.fantasyPointsPpr,
      fantasyPointsPerGame:
        row.fantasyPointsPpr != null && row.games && row.games > 0
          ? Math.round((row.fantasyPointsPpr / row.games) * 10) / 10
          : null,
      keyStats: keyStats(row.stats),
    });
  }

  const trendRows = await db
    .select({
      sleeperPlayerId: weeklyStats.sleeperPlayerId,
      season: weeklyStats.season,
      week: weeklyStats.week,
      fantasyPointsPpr: weeklyStats.fantasyPointsPpr,
    })
    .from(weeklyStats)
    .where(inArray(weeklyStats.sleeperPlayerId, playerIds))
    .orderBy(desc(weeklyStats.season), desc(weeklyStats.week));

  for (const row of trendRows) {
    if (!row.sleeperPlayerId) {
      continue;
    }

    const trend = trendMap.get(row.sleeperPlayerId) ?? [];
    if (trend.length < 5) {
      trend.push({ week: row.week, fantasyPointsPpr: row.fantasyPointsPpr });
      trendMap.set(row.sleeperPlayerId, trend);
    }
  }

  return rows.map((row) =>
    mapPlayer({
      row,
      exposure: exposureMap.get(row.sleeperPlayerId) ?? { rosteredCount: 0, leagueCount: 0, labels: [] },
      summary: seasonMap.get(row.sleeperPlayerId) ?? null,
      trend: [...(trendMap.get(row.sleeperPlayerId) ?? [])].reverse(),
    }),
  );
}

export async function listPlayers(query: PlayerListQuery, userId: string) {
  const where = playerWhere(query);
  const offset = (query.page - 1) * query.pageSize;
  const rows = await db
    .select()
    .from(players)
    .where(where)
    .orderBy(basePlayerOrder(query));
  const enrichedRows = await enrichPlayers(rows, userId);
  const filteredRows = query.rostered
    ? enrichedRows.filter((row) => row.rosterExposure.rosteredCount > 0)
    : enrichedRows;
  const sortedRows = sortMappedPlayers(filteredRows, query);
  const paginatedRows = sortedRows.slice(offset, offset + query.pageSize);

  const total = sortedRows.length;

  return {
    items: paginatedRows,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getPlayerById(sleeperPlayerId: string, userId: string) {
  const row = await db.query.players.findFirst({
    where: eq(players.sleeperPlayerId, sleeperPlayerId),
  });

  if (!row) {
    throw new ApiError("NOT_FOUND", "Player not found.");
  }

  const [enriched] = await enrichPlayers([row], userId);
  return enriched;
}
