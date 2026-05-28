import { z } from "zod";

import { apiResponseSchema } from "@/contracts/api";

export const importSourceSchema = z.enum(["sleeper", "nflverse", "bootstrap", "system"]);
export const importStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "partial"]);

export const createSleeperImportRequestSchema = z.object({
  leagueId: z.string().trim().min(1).optional(),
  sleeperLeagueId: z.string().trim().min(1).max(32).optional(),
  scope: z.enum(["players", "league", "full"]).default("full"),
});

export const createNflverseImportRequestSchema = z.object({
  season: z.coerce.number().int().min(1999).max(2100).optional(),
  week: z.coerce.number().int().min(1).max(23).optional(),
  scope: z.enum(["ids", "weekly", "season", "full"]).default("full"),
});

export const importJobSchema = z.object({
  id: z.string(),
  source: importSourceSchema,
  status: importStatusSchema,
  scope: z.string().nullable(),
  leagueId: z.string().nullable(),
  season: z.number().int().nullable(),
  week: z.number().int().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  counts: z.record(z.string(), z.number()).nullable(),
  error: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const importJobResponseSchema = apiResponseSchema(importJobSchema);

export type ImportJobDto = z.infer<typeof importJobSchema>;
export type CreateSleeperImportRequest = z.infer<typeof createSleeperImportRequestSchema>;
export type CreateNflverseImportRequest = z.infer<typeof createNflverseImportRequestSchema>;
