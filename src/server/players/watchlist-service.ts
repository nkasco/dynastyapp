import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq } from "drizzle-orm";

import type { WatchlistPlayerRequest, WatchlistQuery } from "@/contracts/watchlists";
import { ApiError } from "@/server/api/errors";
import { db } from "@/server/db/client";
import { playerWatchlists, players, userLeagueTeams } from "@/server/db/schema";

function toIso(value: Date) {
  return value.toISOString();
}

async function requireLinkedLeague(leagueId: string, userId: string) {
  const [row] = await db
    .select({ leagueId: userLeagueTeams.leagueId })
    .from(userLeagueTeams)
    .where(and(eq(userLeagueTeams.leagueId, leagueId), eq(userLeagueTeams.userId, userId)))
    .limit(1);

  if (!row) {
    throw new ApiError("NOT_FOUND", "League not found.");
  }
}

async function requirePlayer(sleeperPlayerId: string) {
  const [row] = await db
    .select({ sleeperPlayerId: players.sleeperPlayerId })
    .from(players)
    .where(eq(players.sleeperPlayerId, sleeperPlayerId))
    .limit(1);

  if (!row) {
    throw new ApiError("NOT_FOUND", "Player not found.");
  }
}

function mapWatchlistItem(row: {
  id: string;
  leagueId: string;
  sleeperPlayerId: string;
  fullName: string;
  position: string | null;
  team: string | null;
  status: string | null;
  age: number | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    leagueId: row.leagueId,
    sleeperPlayerId: row.sleeperPlayerId,
    fullName: row.fullName,
    position: row.position,
    team: row.team,
    status: row.status,
    age: row.age,
    createdAt: toIso(row.createdAt),
  };
}

async function findWatchlistItem(input: WatchlistPlayerRequest, userId: string) {
  const [row] = await db
    .select({
      id: playerWatchlists.id,
      leagueId: playerWatchlists.leagueId,
      sleeperPlayerId: playerWatchlists.sleeperPlayerId,
      fullName: players.fullName,
      position: players.position,
      team: players.team,
      status: players.status,
      age: players.age,
      createdAt: playerWatchlists.createdAt,
    })
    .from(playerWatchlists)
    .innerJoin(players, eq(players.sleeperPlayerId, playerWatchlists.sleeperPlayerId))
    .where(
      and(
        eq(playerWatchlists.userId, userId),
        eq(playerWatchlists.leagueId, input.leagueId),
        eq(playerWatchlists.sleeperPlayerId, input.sleeperPlayerId),
      ),
    )
    .limit(1);

  return row ? mapWatchlistItem(row) : null;
}

export async function listWatchlist(query: WatchlistQuery, userId: string) {
  await requireLinkedLeague(query.leagueId, userId);

  const rows = await db
    .select({
      id: playerWatchlists.id,
      leagueId: playerWatchlists.leagueId,
      sleeperPlayerId: playerWatchlists.sleeperPlayerId,
      fullName: players.fullName,
      position: players.position,
      team: players.team,
      status: players.status,
      age: players.age,
      createdAt: playerWatchlists.createdAt,
    })
    .from(playerWatchlists)
    .innerJoin(players, eq(players.sleeperPlayerId, playerWatchlists.sleeperPlayerId))
    .where(and(eq(playerWatchlists.userId, userId), eq(playerWatchlists.leagueId, query.leagueId)))
    .orderBy(desc(playerWatchlists.createdAt), asc(players.fullName));

  return {
    leagueId: query.leagueId,
    items: rows.map(mapWatchlistItem),
  };
}

export async function addWatchlistPlayer(input: WatchlistPlayerRequest, userId: string) {
  await requireLinkedLeague(input.leagueId, userId);
  await requirePlayer(input.sleeperPlayerId);

  const timestamp = new Date();

  await db
    .insert(playerWatchlists)
    .values({
      id: randomUUID(),
      userId,
      leagueId: input.leagueId,
      sleeperPlayerId: input.sleeperPlayerId,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoNothing();

  const item = await findWatchlistItem(input, userId);

  if (!item) {
    throw new ApiError("INTERNAL_ERROR", "Watchlist item could not be saved.");
  }

  return item;
}

export async function removeWatchlistPlayer(input: WatchlistPlayerRequest, userId: string) {
  await requireLinkedLeague(input.leagueId, userId);

  const result = await db
    .delete(playerWatchlists)
    .where(
      and(
        eq(playerWatchlists.userId, userId),
        eq(playerWatchlists.leagueId, input.leagueId),
        eq(playerWatchlists.sleeperPlayerId, input.sleeperPlayerId),
      ),
    );

  return {
    leagueId: input.leagueId,
    sleeperPlayerId: input.sleeperPlayerId,
    removed: result.rowsAffected > 0,
  };
}
