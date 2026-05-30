import { z } from "zod";

import { apiResponseSchema, paginatedSchema, paginationQuerySchema } from "@/contracts/api";

const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const playerSortSchema = z.enum(["name", "age", "position", "team", "updated", "production", "exposure"]);

export const playerListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  leagueId: z.string().trim().max(128).optional(),
  rosterId: z.coerce.number().int().min(1).optional(),
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  position: z.string().trim().max(8).optional(),
  team: z.string().trim().max(8).optional(),
  status: z.string().trim().max(32).optional(),
  rostered: booleanQuerySchema.optional(),
  fantasyRelevant: booleanQuerySchema.optional(),
  injured: booleanQuerySchema.optional(),
  ageMin: z.coerce.number().min(0).max(80).optional(),
  ageMax: z.coerce.number().min(0).max(80).optional(),
  sort: playerSortSchema.default("name"),
  dir: z.enum(["asc", "desc"]).default("asc"),
});

export const playerRosterExposureSchema = z.object({
  rosteredCount: z.number().int().min(0),
  leagueCount: z.number().int().min(0),
  labels: z.array(z.string()),
});

export const playerKeyStatsSchema = z.object({
  passingYards: z.number().nullable(),
  passingTds: z.number().nullable(),
  rushingYards: z.number().nullable(),
  rushingTds: z.number().nullable(),
  receptions: z.number().nullable(),
  receivingYards: z.number().nullable(),
  receivingTds: z.number().nullable(),
});

export const playerSeasonSummarySchema = z.object({
  season: z.number().int(),
  games: z.number().int().nullable(),
  fantasyPoints: z.number().nullable(),
  fantasyPointsPpr: z.number().nullable(),
  fantasyPointsPerGame: z.number().nullable(),
  scoringLabel: z.string(),
  keyStats: playerKeyStatsSchema,
});

export const playerTrendPointSchema = z.object({
  week: z.number().int(),
  fantasyPoints: z.number().nullable(),
  fantasyPointsPpr: z.number().nullable(),
});

export const playerDraftInfoSchema = z.object({
  year: z.number().int(),
  round: z.number().int(),
  pick: z.number().int(),
});

export const playerSchema = z.object({
  sleeperPlayerId: z.string(),
  fullName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  position: z.string().nullable(),
  team: z.string().nullable(),
  status: z.string().nullable(),
  age: z.number().nullable(),
  fantasyPositions: z.array(z.string()).nullable(),
  rosterExposure: playerRosterExposureSchema,
  seasonSummary: playerSeasonSummarySchema.nullable(),
  trend: z.array(playerTrendPointSchema),
  draftInfo: playerDraftInfoSchema.nullable(),
  badges: z.array(z.string()),
  sourceUpdatedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const playerListResponseDataSchema = paginatedSchema(playerSchema).extend({
  availableSeasons: z.array(z.number().int()),
  selectedSeason: z.number().int().nullable(),
  scoring: z.object({
    value: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
    label: z.string(),
  }),
});

export const playersResponseSchema = apiResponseSchema(playerListResponseDataSchema);
export const playerResponseSchema = apiResponseSchema(playerSchema);

export type PlayerListQuery = z.infer<typeof playerListQuerySchema>;
export type PlayerSummary = z.infer<typeof playerSchema>;
