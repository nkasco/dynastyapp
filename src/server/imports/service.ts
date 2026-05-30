import "server-only";

import { and, eq } from "drizzle-orm";

import type { CreateNflverseImportRequest, CreateSleeperImportRequest } from "@/contracts/imports";
import { db } from "@/server/db/client";
import { importJobs, leagues, userLeagueTeams, type NewImportJob } from "@/server/db/schema";
import { ApiError } from "@/server/api/errors";
import { createIdempotentImportJob, runNightlyRefresh, runQueuedImportJobs } from "@/server/imports/runner";

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapImportJob(row: typeof importJobs.$inferSelect) {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    scope: row.scope,
    leagueId: row.leagueId,
    season: row.season,
    week: row.week,
    startedAt: toIso(row.startedAt),
    endedAt: toIso(row.endedAt),
    counts: row.counts,
    error: row.error,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createImportJob(input: Omit<NewImportJob, "id" | "status" | "createdAt" | "updatedAt">) {
  const job = await createIdempotentImportJob(input);
  return mapImportJob(job);
}

async function requireLinkedSleeperLeague(input: CreateSleeperImportRequest, userId: string) {
  if (input.scope === "players") {
    return null;
  }

  if (!input.leagueId && !input.sleeperLeagueId) {
    throw new ApiError("BAD_REQUEST", "Sleeper league imports require a linked league.");
  }

  const filters = [eq(userLeagueTeams.userId, userId)];

  if (input.leagueId) {
    filters.push(eq(userLeagueTeams.leagueId, input.leagueId));
  }

  if (input.sleeperLeagueId) {
    filters.push(eq(leagues.sleeperLeagueId, input.sleeperLeagueId));
  }

  const [row] = await db
    .select({ leagueId: leagues.id, sleeperLeagueId: leagues.sleeperLeagueId })
    .from(userLeagueTeams)
    .innerJoin(leagues, eq(leagues.id, userLeagueTeams.leagueId))
    .where(and(...filters))
    .limit(1);

  if (!row) {
    throw new ApiError("FORBIDDEN", "Link this Sleeper league to your profile before importing its league data.");
  }

  return row;
}

export async function queueSleeperImport(input: CreateSleeperImportRequest, userId: string) {
  const linkedLeague = await requireLinkedSleeperLeague(input, userId);

  return createImportJob({
    userId,
    source: "sleeper",
    scope: input.scope,
    leagueId: linkedLeague?.leagueId ?? input.leagueId ?? null,
    metadata: linkedLeague?.sleeperLeagueId
      ? { sleeperLeagueId: linkedLeague.sleeperLeagueId }
      : input.sleeperLeagueId
        ? { sleeperLeagueId: input.sleeperLeagueId }
        : null,
  });
}

export async function queueNflverseImport(input: CreateNflverseImportRequest) {
  return createImportJob({
    source: "nflverse",
    scope: input.scope,
    season: input.season ?? null,
    week: input.week ?? null,
  });
}

export function isSharedImportJob(row: Pick<typeof importJobs.$inferSelect, "source" | "scope" | "leagueId" | "userId">) {
  if (row.userId || row.leagueId) {
    return false;
  }

  if (row.source === "nflverse" || row.source === "system") {
    return true;
  }

  return row.source === "sleeper" && row.scope === "players";
}

async function userCanReadLeagueImport(leagueId: string, userId: string) {
  const [row] = await db
    .select({ leagueId: userLeagueTeams.leagueId })
    .from(userLeagueTeams)
    .where(and(eq(userLeagueTeams.userId, userId), eq(userLeagueTeams.leagueId, leagueId)))
    .limit(1);

  return Boolean(row);
}

export async function getImportJob(id: string, userId: string) {
  const row = await db.query.importJobs.findFirst({
    where: eq(importJobs.id, id),
  });

  if (!row) {
    throw new ApiError("NOT_FOUND", "Import job not found.");
  }

  const canRead =
    row.userId === userId ||
    isSharedImportJob(row) ||
    (row.leagueId ? await userCanReadLeagueImport(row.leagueId, userId) : false);

  if (!canRead) {
    throw new ApiError("NOT_FOUND", "Import job not found.");
  }

  return mapImportJob(row);
}

export async function runQueuedImports() {
  const jobs = await runQueuedImportJobs();
  return jobs.flatMap((job) => (job ? [mapImportJob(job)] : []));
}

export async function triggerNightlyRefresh() {
  const job = await runNightlyRefresh();

  if (!job) {
    throw new ApiError("INTERNAL_ERROR", "Nightly refresh did not return an import job.");
  }

  return mapImportJob(job);
}
