import "server-only";

import { and, asc, count, desc, eq, like, type SQL } from "drizzle-orm";

import type { LeagueListQuery, LinkLeagueRequest } from "@/contracts/leagues";
import { db } from "@/server/db/client";
import { leagues, rosters } from "@/server/db/schema";
import { ApiError } from "@/server/api/errors";
import { createImportJob } from "@/server/imports/service";

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

async function rosterCountByLeague(leagueId: string) {
  const [row] = await db.select({ value: count() }).from(rosters).where(eq(rosters.leagueId, leagueId));
  return row?.value ?? 0;
}

async function mapLeague(row: typeof leagues.$inferSelect) {
  return {
    id: row.id,
    sleeperLeagueId: row.sleeperLeagueId,
    name: row.name,
    season: row.season,
    status: row.status,
    sport: row.sport,
    rosterCount: await rosterCountByLeague(row.id),
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

export async function listLeagues(query: LeagueListQuery) {
  const where = leagueWhere(query);
  const offset = (query.page - 1) * query.pageSize;

  const [totalRow] = await db.select({ value: count() }).from(leagues).where(where);
  const rows = await db
    .select()
    .from(leagues)
    .where(where)
    .orderBy(leagueOrder(query), asc(leagues.name))
    .limit(query.pageSize)
    .offset(offset);

  const total = totalRow?.value ?? 0;

  return {
    items: await Promise.all(rows.map(mapLeague)),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getLeagueById(id: string) {
  const row = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!row) {
    throw new ApiError("NOT_FOUND", "League not found.");
  }

  return mapLeague(row);
}

export async function queueLeagueLink(input: LinkLeagueRequest) {
  const job = await createImportJob({
    source: "sleeper",
    scope: "league-link",
    metadata: { sleeperLeagueId: input.sleeperLeagueId },
  });

  return {
    sleeperLeagueId: input.sleeperLeagueId,
    importJobId: job.id,
    status: "queued" as const,
    message: "League link queued. Sleeper remains read-only; ingestion will own the actual import.",
  };
}
