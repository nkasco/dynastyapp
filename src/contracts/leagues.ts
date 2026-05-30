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
  rosterId: z.number().int().min(1),
});

export const pprScoringValueSchema = z.union([z.literal(0), z.literal(0.5), z.literal(1)]);

export const updateLeagueSettingsRequestSchema = z.object({
  pprScoringPreference: pprScoringValueSchema,
});

export const leaguePreviewQuerySchema = z.object({
  sleeperLeagueId: z.string().trim().min(1).max(32),
});

export const pprScoringSchema = z.object({
  value: pprScoringValueSchema.nullable(),
  label: z.string(),
  source: z.enum(["sleeper", "profile", "unknown"]),
  canSetProfilePreference: z.boolean(),
});

export const leagueRosterSchema = z.object({
  rosterId: z.number().int(),
  ownerName: z.string(),
  playerCount: z.number().int().min(0),
  isUserRoster: z.boolean(),
});

export const leagueSchema = z.object({
  id: z.string(),
  sleeperLeagueId: z.string(),
  name: z.string(),
  season: z.number().int(),
  status: z.string().nullable(),
  sport: z.string(),
  pprScoring: pprScoringSchema,
  rosterCount: z.number().int().min(0),
  rosters: z.array(leagueRosterSchema),
  importedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const linkedLeagueSchema = z.object({
  leagueId: z.string(),
  sleeperLeagueId: z.string(),
  rosterId: z.number().int(),
  importJobId: z.string(),
  status: z.literal("queued"),
  message: z.string(),
});

export const deletedLeagueSchema = z.object({
  leagueId: z.string(),
  deletedLeagueData: z.boolean(),
});

export const leaguePreviewRosterSchema = z.object({
  rosterId: z.number().int(),
  ownerSleeperUserId: z.string().nullable(),
  ownerName: z.string(),
  playerCount: z.number().int().min(0),
  starterCount: z.number().int().min(0),
});

export const leaguePreviewSchema = z.object({
  sleeperLeagueId: z.string(),
  name: z.string(),
  season: z.number().int(),
  status: z.string().nullable(),
  rosterCount: z.number().int().min(0),
  userCount: z.number().int().min(0),
  rosters: z.array(leaguePreviewRosterSchema),
});

export const leaguesResponseSchema = apiResponseSchema(paginatedSchema(leagueSchema));
export const leagueResponseSchema = apiResponseSchema(leagueSchema);
export const linkLeagueResponseSchema = apiResponseSchema(linkedLeagueSchema);
export const deleteLeagueResponseSchema = apiResponseSchema(deletedLeagueSchema);
export const leaguePreviewResponseSchema = apiResponseSchema(leaguePreviewSchema);

export type LeagueListQuery = z.infer<typeof leagueListQuerySchema>;
export type LinkLeagueRequest = z.infer<typeof linkLeagueRequestSchema>;
export type UpdateLeagueSettingsRequest = z.infer<typeof updateLeagueSettingsRequestSchema>;
export type LeaguePreviewQuery = z.infer<typeof leaguePreviewQuerySchema>;
export type LeagueSummary = z.infer<typeof leagueSchema>;
export type LeaguePreview = z.infer<typeof leaguePreviewSchema>;
