import "server-only";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { CreateNflverseImportRequest, CreateSleeperImportRequest } from "@/contracts/imports";
import { db } from "@/server/db/client";
import { importJobs, type NewImportJob } from "@/server/db/schema";
import { ApiError } from "@/server/api/errors";

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
  const now = new Date();
  const job = {
    id: randomUUID(),
    status: "queued" as const,
    error: null,
    leagueId: null,
    metadata: null,
    scope: null,
    season: null,
    startedAt: null,
    endedAt: null,
    counts: null,
    week: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  };

  await db.insert(importJobs).values(job);
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
