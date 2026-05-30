import { randomUUID } from "node:crypto";

import { and, asc, count, eq, isNull, lte, ne } from "drizzle-orm";

import { env } from "@/env";
import { db } from "@/server/db/client";
import { importJobs, importLocks, leagues, warningQueue, type ImportJob, type NewImportJob } from "@/server/db/schema";
import { importSleeperJob } from "@/server/sleeper/service";

type ImportCounts = Record<string, number>;
type ImportMetadata = Record<string, unknown>;
type ImportSource = ImportJob["source"];
type ImportStatus = ImportJob["status"];

type ImportExecutionResult = {
  status?: Extract<ImportStatus, "succeeded" | "partial">;
  counts?: ImportCounts;
  metadata?: ImportMetadata;
  warnings?: string[];
};

type RunQueuedOptions = {
  limit?: number;
  lockTtlMs?: number;
  attempts?: number;
  backoffMs?: number;
};

const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 750;

function now() {
  return new Date();
}

function nullableEq<TColumn>(column: TColumn, value: string | number | null | undefined) {
  return value == null ? isNull(column as never) : eq(column as never, value);
}

function metadataWith(base: ImportJob["metadata"], patch: ImportMetadata) {
  return {
    ...((base ?? {}) as ImportMetadata),
    ...patch,
  };
}

export function importIdentity(input: Pick<NewImportJob, "source" | "scope" | "leagueId" | "season" | "week">) {
  return {
    source: input.source,
    scope: input.scope ?? null,
    leagueId: input.leagueId ?? null,
    season: input.season ?? null,
    week: input.week ?? null,
  };
}

export function importLockKey(input: Pick<NewImportJob, "source" | "scope" | "leagueId" | "season" | "week">) {
  const identity = importIdentity(input);

  return [
    "import",
    identity.source,
    identity.scope ?? "all",
    identity.leagueId ?? "global",
    identity.season ?? "all-seasons",
    identity.week ?? "all-weeks",
  ].join(":");
}

export function isTemporaryImportError(error: unknown) {
  if (typeof error === "object" && error !== null && "temporary" in error && error.temporary === true) {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /\b(429|5\d\d|timeout|timed out|network|econnreset|fetch failed|temporar)/.test(message);
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function findActiveImportJob(input: Pick<NewImportJob, "source" | "scope" | "leagueId" | "season" | "week">) {
  const identity = importIdentity(input);

  return db.query.importJobs.findFirst({
    where: and(
      eq(importJobs.source, identity.source),
      nullableEq(importJobs.scope, identity.scope),
      nullableEq(importJobs.leagueId, identity.leagueId),
      nullableEq(importJobs.season, identity.season),
      nullableEq(importJobs.week, identity.week),
      ne(importJobs.status, "succeeded"),
      ne(importJobs.status, "failed"),
      ne(importJobs.status, "partial"),
    ),
    orderBy: [asc(importJobs.createdAt)],
  });
}

export async function createIdempotentImportJob(input: Omit<NewImportJob, "id" | "status" | "createdAt" | "updatedAt">) {
  const activeJob = await findActiveImportJob(input);

  if (activeJob) {
    return activeJob;
  }

  const timestamp = now();
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
    createdAt: timestamp,
    updatedAt: timestamp,
    ...input,
  };

  await db.insert(importJobs).values(job);
  return job;
}

async function acquireImportLock(input: {
  lockKey: string;
  source: ImportSource;
  ownerId: string;
  ttlMs?: number;
  metadata?: ImportMetadata;
}) {
  const timestamp = now();

  await db.delete(importLocks).where(and(eq(importLocks.lockKey, input.lockKey), lte(importLocks.expiresAt, timestamp)));

  const result = await db
    .insert(importLocks)
    .values({
      lockKey: input.lockKey,
      source: input.source,
      ownerId: input.ownerId,
      acquiredAt: timestamp,
      expiresAt: new Date(timestamp.getTime() + (input.ttlMs ?? DEFAULT_LOCK_TTL_MS)),
      metadata: input.metadata ?? null,
    })
    .onConflictDoNothing();

  return result.rowsAffected > 0;
}

async function releaseImportLock(lockKey: string, ownerId: string) {
  await db.delete(importLocks).where(and(eq(importLocks.lockKey, lockKey), eq(importLocks.ownerId, ownerId)));
}

async function markImportJob(
  id: string,
  values: Partial<Pick<ImportJob, "status" | "startedAt" | "endedAt" | "counts" | "error" | "metadata">>,
) {
  await db
    .update(importJobs)
    .set({
      ...values,
      updatedAt: now(),
    })
    .where(eq(importJobs.id, id));
}

async function recordImportWarnings(job: ImportJob, warnings: string[]) {
  if (warnings.length === 0) {
    return;
  }

  const timestamp = now();

  await db.insert(warningQueue).values(
    warnings.map((message) => ({
      id: randomUUID(),
      source: job.source,
      code: "IMPORT_WARNING",
      message,
      severity: "warning" as const,
      leagueId: job.leagueId,
      metadata: {
        jobId: job.id,
        scope: job.scope,
        season: job.season,
        week: job.week,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );
}

async function executeSleeperJob(job: ImportJob): Promise<ImportExecutionResult> {
  return importSleeperJob(job);
}

async function executeNflverseJob(job: ImportJob): Promise<ImportExecutionResult> {
  return {
    counts: { unitsImported: 0, unitsSkipped: 1 },
    metadata: {
      ...(job.metadata ?? {}),
      runner: "ready",
      note: "nflverse source execution hook is wired; stats ingestion begins in Phase 8.",
      readOnly: true,
    },
  };
}

async function executeSystemJob(job: ImportJob): Promise<ImportExecutionResult> {
  return {
    counts: { unitsImported: 0, unitsSkipped: 1 },
    metadata: {
      ...(job.metadata ?? {}),
      runner: "ready",
    },
  };
}

async function executeImportJob(job: ImportJob) {
  switch (job.source) {
    case "sleeper":
      return executeSleeperJob(job);
    case "nflverse":
      return executeNflverseJob(job);
    case "bootstrap":
    case "system":
      return executeSystemJob(job);
  }
}

async function executeWithRetry(job: ImportJob, options: Required<Pick<RunQueuedOptions, "attempts" | "backoffMs">>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const result = await executeImportJob(job);
      return {
        ...result,
        metadata: {
          ...(result.metadata ?? {}),
          attempts: attempt,
        },
      };
    } catch (error) {
      lastError = error;

      if (attempt === options.attempts || !isTemporaryImportError(error)) {
        throw error;
      }

      await delay(options.backoffMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

export async function runImportJob(jobId: string, options: RunQueuedOptions = {}) {
  const job = await db.query.importJobs.findFirst({
    where: eq(importJobs.id, jobId),
  });

  if (!job) {
    throw new Error(`Import job ${jobId} was not found.`);
  }

  if (job.status === "succeeded" || job.status === "partial") {
    return job;
  }

  const ownerId = randomUUID();
  const lockKey = importLockKey(job);
  const acquired = await acquireImportLock({
    lockKey,
    source: job.source,
    ownerId,
    ttlMs: options.lockTtlMs,
    metadata: { jobId: job.id },
  });

  if (!acquired) {
    await markImportJob(job.id, {
      metadata: metadataWith(job.metadata, {
        lockKey,
        skippedReason: "An equivalent import is already running.",
      }),
    });

    return job;
  }

  try {
    await markImportJob(job.id, {
      status: "running",
      startedAt: job.startedAt ?? now(),
      error: null,
      metadata: metadataWith(job.metadata, { lockKey }),
    });

    const result = await executeWithRetry(job, {
      attempts: options.attempts ?? DEFAULT_ATTEMPTS,
      backoffMs: options.backoffMs ?? DEFAULT_BACKOFF_MS,
    });
    const warnings = result.warnings ?? [];

    await recordImportWarnings(job, warnings);

    await markImportJob(job.id, {
      status: result.status ?? "succeeded",
      endedAt: now(),
      counts: {
        ...(result.counts ?? {}),
        warnings: warnings.length,
      },
      error: null,
      metadata: metadataWith(job.metadata, {
        lockKey,
        ...(result.metadata ?? {}),
        warnings,
      }),
    });
  } catch (error) {
    await markImportJob(job.id, {
      status: "failed",
      endedAt: now(),
      error: error instanceof Error ? error.message : String(error),
      metadata: metadataWith(job.metadata, { lockKey }),
    });
  } finally {
    await releaseImportLock(lockKey, ownerId);
  }

  return db.query.importJobs.findFirst({
    where: eq(importJobs.id, job.id),
  });
}

export async function runQueuedImportJobs(options: RunQueuedOptions = {}) {
  const queuedJobs = await db.query.importJobs.findMany({
    where: eq(importJobs.status, "queued"),
    orderBy: [asc(importJobs.createdAt)],
    limit: options.limit ?? 25,
  });

  const results = [];

  for (const job of queuedJobs) {
    results.push(await runImportJob(job.id, options));
  }

  return results;
}

function currentFootballSeason(date = new Date()) {
  const month = date.getMonth();
  return month < 2 ? date.getFullYear() - 1 : date.getFullYear();
}

async function enqueueNightlySourceJobs() {
  const season = currentFootballSeason();
  const linkedLeagues = await db.select({ id: leagues.id }).from(leagues).orderBy(asc(leagues.name));
  const jobs: ImportJob[] = [];

  jobs.push(
    await createIdempotentImportJob({
      source: "sleeper",
      scope: "players",
      metadata: { cadence: "daily" },
    }),
  );

  for (const league of linkedLeagues) {
    jobs.push(
      await createIdempotentImportJob({
        source: "sleeper",
        scope: "league",
        leagueId: league.id,
        season,
        metadata: { cadence: "nightly" },
      }),
    );
  }

  jobs.push(
    await createIdempotentImportJob({
      source: "nflverse",
      scope: "full",
      season,
      metadata: {
        cadence: "nightly",
        seasons: Array.from({ length: 6 }, (_, index) => season - index),
      },
    }),
  );

  return jobs;
}

export async function runNightlyRefresh(options: RunQueuedOptions = {}) {
  const parentJob = await createIdempotentImportJob({
    source: "system",
    scope: "nightly-refresh",
    metadata: {
      scheduledFor: env.IMPORT_NIGHTLY_CRON,
      timeZone: env.IMPORT_TIME_ZONE,
      manualSafe: true,
    },
  });

  const ownerId = randomUUID();
  const lockKey = "refresh:nightly";
  const acquired = await acquireImportLock({
    lockKey,
    source: "system",
    ownerId,
    ttlMs: options.lockTtlMs,
    metadata: { jobId: parentJob.id },
  });

  if (!acquired) {
    await markImportJob(parentJob.id, {
      status: "partial",
      endedAt: now(),
      counts: { jobsQueued: 0, jobsRun: 0, warnings: 1 },
      error: "Nightly refresh is already running.",
      metadata: metadataWith(parentJob.metadata, { lockKey }),
    });

    return parentJob;
  }

  try {
    await markImportJob(parentJob.id, {
      status: "running",
      startedAt: parentJob.startedAt ?? now(),
      metadata: metadataWith(parentJob.metadata, { lockKey }),
    });

    const jobs = await enqueueNightlySourceJobs();
    const results = await runQueuedImportJobs(options);
    const statusCounts = results.reduce<Record<string, number>>((countsByStatus, result) => {
      const status = result?.status ?? "unknown";
      countsByStatus[status] = (countsByStatus[status] ?? 0) + 1;
      return countsByStatus;
    }, {});
    const failed = statusCounts.failed ?? 0;
    const partial = statusCounts.partial ?? 0;

    await markImportJob(parentJob.id, {
      status: failed > 0 || partial > 0 ? "partial" : "succeeded",
      endedAt: now(),
      counts: {
        jobsQueued: jobs.length,
        jobsRun: results.length,
        jobsSucceeded: statusCounts.succeeded ?? 0,
        jobsPartial: partial,
        jobsFailed: failed,
        warnings: failed + partial,
      },
      error: failed > 0 ? `${failed} import job(s) failed during nightly refresh.` : null,
      metadata: metadataWith(parentJob.metadata, {
        lockKey,
        childJobIds: jobs.map((job) => job.id),
      }),
    });
  } catch (error) {
    await markImportJob(parentJob.id, {
      status: "failed",
      endedAt: now(),
      error: error instanceof Error ? error.message : String(error),
      metadata: metadataWith(parentJob.metadata, { lockKey }),
    });
  } finally {
    await releaseImportLock(lockKey, ownerId);
  }

  return db.query.importJobs.findFirst({
    where: eq(importJobs.id, parentJob.id),
  });
}

export async function importJobCountsByStatus() {
  return db.select({ status: importJobs.status, value: count() }).from(importJobs).groupBy(importJobs.status);
}
