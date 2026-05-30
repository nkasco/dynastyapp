import "server-only";

import { and, asc, count, desc, eq, like, type SQL } from "drizzle-orm";

import type {
  LeagueListQuery,
  LeaguePreviewQuery,
  LinkLeagueRequest,
  UpdateLeagueSettingsRequest,
} from "@/contracts/leagues";
import { db } from "@/server/db/client";
import { leagueUsers, leagues, rosterPlayers, rosters, userLeagueTeams } from "@/server/db/schema";
import { ApiError } from "@/server/api/errors";
import { createImportJob } from "@/server/imports/service";
import { SleeperClient, SleeperHttpError } from "@/server/sleeper/service";

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

async function rosterCountByLeague(leagueId: string) {
  const [row] = await db.select({ value: count() }).from(rosters).where(eq(rosters.leagueId, leagueId));
  return row?.value ?? 0;
}

async function rosterOptionsByLeague(leagueId: string, userRosterId?: number | null) {
  const rows = await db
    .select({
      rosterId: rosters.rosterId,
      ownerName: leagueUsers.displayName,
      username: leagueUsers.username,
      playerCount: count(rosterPlayers.sleeperPlayerId),
    })
    .from(rosters)
    .leftJoin(leagueUsers, and(eq(leagueUsers.leagueId, rosters.leagueId), eq(leagueUsers.sleeperUserId, rosters.ownerSleeperUserId)))
    .leftJoin(
      rosterPlayers,
      and(
        eq(rosterPlayers.leagueId, rosters.leagueId),
        eq(rosterPlayers.rosterId, rosters.rosterId),
        eq(rosterPlayers.slot, "roster"),
      ),
    )
    .where(eq(rosters.leagueId, leagueId))
    .groupBy(rosters.rosterId, leagueUsers.displayName, leagueUsers.username)
    .orderBy(asc(rosters.rosterId));

  return rows.map((row) => ({
    rosterId: row.rosterId,
    ownerName: row.ownerName ?? row.username ?? `Roster ${row.rosterId}`,
    playerCount: row.playerCount,
    isUserRoster: row.rosterId === userRosterId,
  }));
}

type PprScoringValue = 0 | 0.5 | 1;

const pprLabels: Record<PprScoringValue, string> = {
  0: "Standard",
  0.5: "Half PPR",
  1: "Full PPR",
};

function normalizePprValue(value: unknown): PprScoringValue | null {
  const parsed = typeof value === "string" ? Number(value) : value;

  if (parsed === 0 || parsed === 0.5 || parsed === 1) {
    return parsed;
  }

  return null;
}

export function pprScoringFromSettings(
  scoringSettings: Record<string, unknown> | null,
  profilePreference?: number | null,
) {
  const sleeperValue = normalizePprValue(scoringSettings?.rec);

  if (sleeperValue != null) {
    return {
      value: sleeperValue,
      label: pprLabels[sleeperValue],
      source: "sleeper" as const,
      canSetProfilePreference: false,
    };
  }

  const profileValue = normalizePprValue(profilePreference);

  if (profileValue != null) {
    return {
      value: profileValue,
      label: pprLabels[profileValue],
      source: "profile" as const,
      canSetProfilePreference: true,
    };
  }

  return {
    value: null,
    label: "Unknown PPR",
    source: "unknown" as const,
    canSetProfilePreference: true,
  };
}

async function mapLeague(
  row: typeof leagues.$inferSelect,
  profilePreference?: number | null,
  userRosterId?: number | null,
) {
  return {
    id: row.id,
    sleeperLeagueId: row.sleeperLeagueId,
    name: row.name,
    season: row.season,
    status: row.status,
    sport: row.sport,
    pprScoring: pprScoringFromSettings(row.scoringSettings, profilePreference),
    rosterCount: await rosterCountByLeague(row.id),
    rosters: await rosterOptionsByLeague(row.id, userRosterId),
    importedAt: toIso(row.importedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function leagueWhere(query: LeagueListQuery) {
  const filters: SQL[] = [];

  if (query.q) {
    filters.push(like(leagues.name, `%${query.q}%`));
  }

  if (query.season) {
    filters.push(eq(leagues.season, query.season));
  }

  return filters.length ? and(...filters) : undefined;
}

function leagueOrder(query: LeagueListQuery) {
  const direction = query.dir === "desc" ? desc : asc;

  switch (query.sort) {
    case "name":
      return direction(leagues.name);
    case "updated":
      return direction(leagues.updatedAt);
    case "season":
    default:
      return direction(leagues.season);
  }
}

export async function listLeagues(query: LeagueListQuery, userId: string) {
  const filters = [eq(userLeagueTeams.userId, userId), leagueWhere(query)].filter(Boolean) as SQL[];
  const where = and(...filters);
  const offset = (query.page - 1) * query.pageSize;

  const [totalRow] = await db
    .select({ value: count() })
    .from(leagues)
    .innerJoin(userLeagueTeams, eq(userLeagueTeams.leagueId, leagues.id))
    .where(where);
  const rows = await db
    .select({
      league: leagues,
      rosterId: userLeagueTeams.rosterId,
      pprScoringPreference: userLeagueTeams.pprScoringPreference,
    })
    .from(leagues)
    .innerJoin(userLeagueTeams, eq(userLeagueTeams.leagueId, leagues.id))
    .where(where)
    .orderBy(leagueOrder(query), asc(leagues.name))
    .limit(query.pageSize)
    .offset(offset);

  const total = totalRow?.value ?? 0;

  return {
    items: await Promise.all(rows.map((row) => mapLeague(row.league, row.pprScoringPreference, row.rosterId))),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getLeagueById(id: string, userId: string) {
  const [row] = await db
    .select({
      league: leagues,
      rosterId: userLeagueTeams.rosterId,
      pprScoringPreference: userLeagueTeams.pprScoringPreference,
    })
    .from(leagues)
    .innerJoin(userLeagueTeams, eq(userLeagueTeams.leagueId, leagues.id))
    .where(and(eq(leagues.id, id), eq(userLeagueTeams.userId, userId)))
    .limit(1);

  if (!row) {
    throw new ApiError("NOT_FOUND", "League not found.");
  }

  return mapLeague(row.league, row.pprScoringPreference, row.rosterId);
}

export async function updateLeagueSettings(id: string, input: UpdateLeagueSettingsRequest, userId: string) {
  const existing = await db
    .select({ leagueId: userLeagueTeams.leagueId })
    .from(userLeagueTeams)
    .where(and(eq(userLeagueTeams.leagueId, id), eq(userLeagueTeams.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    throw new ApiError("NOT_FOUND", "League not found.");
  }

  await db
    .update(userLeagueTeams)
    .set({
      pprScoringPreference: input.pprScoringPreference,
      updatedAt: new Date(),
    })
    .where(and(eq(userLeagueTeams.leagueId, id), eq(userLeagueTeams.userId, userId)));

  return getLeagueById(id, userId);
}

function leagueIdFromSleeper(sleeperLeagueId: string) {
  return `sleeper:${sleeperLeagueId}`;
}

function seasonNumber(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

function sleeperErrorToApi(error: unknown, sleeperLeagueId: string): never {
  if (error instanceof SleeperHttpError && error.status === 404) {
    throw new ApiError("NOT_FOUND", `Sleeper league ${sleeperLeagueId} was not found.`);
  }

  throw error;
}

export async function previewLeagueLink(input: LeaguePreviewQuery) {
  const client = new SleeperClient();

  try {
    const [league, users, sleeperRosters] = await Promise.all([
      client.getLeague(input.sleeperLeagueId),
      client.getLeagueUsers(input.sleeperLeagueId),
      client.getLeagueRosters(input.sleeperLeagueId),
    ]);
    const usersById = new Map(users.map((user) => [user.user_id, user]));

    return {
      sleeperLeagueId: league.league_id,
      name: league.name ?? `Sleeper league ${league.league_id}`,
      season: seasonNumber(league.season),
      status: league.status ?? null,
      rosterCount: sleeperRosters.length,
      userCount: users.length,
      rosters: sleeperRosters
        .map((roster) => {
          const owner = roster.owner_id ? usersById.get(roster.owner_id) : undefined;

          return {
            rosterId: roster.roster_id,
            ownerSleeperUserId: roster.owner_id ?? null,
            ownerName: owner?.display_name ?? owner?.username ?? roster.owner_id ?? `Roster ${roster.roster_id}`,
            playerCount: roster.players?.length ?? 0,
            starterCount: roster.starters?.length ?? 0,
          };
        })
        .sort((left, right) => left.rosterId - right.rosterId),
    };
  } catch (error) {
    sleeperErrorToApi(error, input.sleeperLeagueId);
  }
}

async function upsertPreviewLeague(input: LinkLeagueRequest) {
  const client = new SleeperClient();

  try {
    const [league, sleeperRosters] = await Promise.all([
      client.getLeague(input.sleeperLeagueId),
      client.getLeagueRosters(input.sleeperLeagueId),
    ]);

    if (!sleeperRosters.some((roster) => roster.roster_id === input.rosterId)) {
      throw new ApiError("BAD_REQUEST", "Select one of the rosters from this Sleeper league.");
    }

    const timestamp = new Date();
    const leagueId = leagueIdFromSleeper(league.league_id);

    await db
      .insert(leagues)
      .values({
        id: leagueId,
        sleeperLeagueId: league.league_id,
        name: league.name ?? `Sleeper league ${league.league_id}`,
        avatar: league.avatar ?? null,
        season: seasonNumber(league.season),
        status: league.status ?? null,
        sport: league.sport ?? "nfl",
        scoringSettings: league.scoring_settings ?? null,
        rosterPositions: league.roster_positions ?? null,
        settings: league.settings ?? null,
        metadata: league.metadata ?? null,
        importedAt: null,
        sourceUpdatedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: leagues.sleeperLeagueId,
        set: {
          name: league.name ?? `Sleeper league ${league.league_id}`,
          avatar: league.avatar ?? null,
          season: seasonNumber(league.season),
          status: league.status ?? null,
          sport: league.sport ?? "nfl",
          scoringSettings: league.scoring_settings ?? null,
          rosterPositions: league.roster_positions ?? null,
          settings: league.settings ?? null,
          metadata: league.metadata ?? null,
          sourceUpdatedAt: timestamp,
          updatedAt: timestamp,
        },
      });

    return leagueId;
  } catch (error) {
    sleeperErrorToApi(error, input.sleeperLeagueId);
  }
}

export async function queueLeagueLink(input: LinkLeagueRequest, userId: string) {
  const leagueId = await upsertPreviewLeague(input);

  await db
    .insert(userLeagueTeams)
    .values({
      userId,
      leagueId,
      rosterId: input.rosterId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userLeagueTeams.userId, userLeagueTeams.leagueId],
      set: {
        rosterId: input.rosterId,
        updatedAt: new Date(),
      },
    });

  const job = await createImportJob({
    source: "sleeper",
    scope: "league-link",
    leagueId,
    userId,
    metadata: { sleeperLeagueId: input.sleeperLeagueId, selectedRosterId: input.rosterId },
  });

  return {
    leagueId,
    sleeperLeagueId: input.sleeperLeagueId,
    rosterId: input.rosterId,
    importJobId: job.id,
    status: "queued" as const,
    message: "League link queued. Sleeper remains read-only while the local import fills in league context.",
  };
}
