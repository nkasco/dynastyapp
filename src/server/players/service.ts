import "server-only";

import { and, asc, count, desc, eq, like, type SQL } from "drizzle-orm";

import type { PlayerListQuery } from "@/contracts/players";
import { db } from "@/server/db/client";
import { players } from "@/server/db/schema";
import { ApiError } from "@/server/api/errors";

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapPlayer(row: typeof players.$inferSelect) {
  return {
    sleeperPlayerId: row.sleeperPlayerId,
    fullName: row.fullName,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position,
    team: row.team,
    status: row.status,
    age: row.age,
    fantasyPositions: row.fantasyPositions,
    sourceUpdatedAt: toIso(row.sourceUpdatedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function playerWhere(query: PlayerListQuery) {
  const filters: SQL[] = [];

  if (query.q) {
    filters.push(like(players.searchName, `%${query.q.toLowerCase()}%`));
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

  return filters.length ? and(...filters) : undefined;
}

function playerOrder(query: PlayerListQuery) {
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
    case "name":
    default:
      return direction(players.fullName);
  }
}

export async function listPlayers(query: PlayerListQuery) {
  const where = playerWhere(query);
  const offset = (query.page - 1) * query.pageSize;

  const [totalRow] = await db.select({ value: count() }).from(players).where(where);
  const rows = await db
    .select()
    .from(players)
    .where(where)
    .orderBy(playerOrder(query))
    .limit(query.pageSize)
    .offset(offset);

  const total = totalRow?.value ?? 0;

  return {
    items: rows.map(mapPlayer),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getPlayerById(sleeperPlayerId: string) {
  const row = await db.query.players.findFirst({
    where: eq(players.sleeperPlayerId, sleeperPlayerId),
  });

  if (!row) {
    throw new ApiError("NOT_FOUND", "Player not found.");
  }

  return mapPlayer(row);
}
