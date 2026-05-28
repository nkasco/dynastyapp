import { z } from "zod";

import { apiResponseSchema, paginatedSchema, paginationQuerySchema } from "@/contracts/api";

export const leagueSortSchema = z.enum(["name", "season", "updated"]);

export const leagueListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  sort: leagueSortSchema.default("season"),
  dir: z.enum(["asc", "desc"]).default("desc"),
});

export const linkLeagueRequestSchema = z.object({
  sleeperLeagueId: z.string().trim().min(1).max(32),
});

export const leagueSchema = z.object({
  id: z.string(),
  sleeperLeagueId: z.string(),
  name: z.string(),
  season: z.number().int(),
  status: z.string().nullable(),
  sport: z.string(),
  rosterCount: z.number().int().min(0),
  importedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const linkedLeagueSchema = z.object({
  sleeperLeagueId: z.string(),
  importJobId: z.string(),
  status: z.literal("queued"),
  message: z.string(),
});

export const leaguesResponseSchema = apiResponseSchema(paginatedSchema(leagueSchema));
export const leagueResponseSchema = apiResponseSchema(leagueSchema);
export const linkLeagueResponseSchema = apiResponseSchema(linkedLeagueSchema);

export type LeagueListQuery = z.infer<typeof leagueListQuerySchema>;
export type LinkLeagueRequest = z.infer<typeof linkLeagueRequestSchema>;
export type LeagueSummary = z.infer<typeof leagueSchema>;
