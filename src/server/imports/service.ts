import "server-only";

import { eq } from "drizzle-orm";

import type { CreateNflverseImportRequest, CreateSleeperImportRequest } from "@/contracts/imports";
import { db } from "@/server/db/client";
import { importJobs, type NewImportJob } from "@/server/db/schema";
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

export async function queueSleeperImport(input: CreateSleeperImportRequest) {
  return createImportJob({
    source: "sleeper",
    scope: input.scope,
    leagueId: input.leagueId ?? null,
    metadata: input.sleeperLeagueId ? { sleeperLeagueId: input.sleeperLeagueId } : null,
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

export async function getImportJob(id: string) {
  const row = await db.query.importJobs.findFirst({
    where: eq(importJobs.id, id),
  });

  if (!row) {
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
