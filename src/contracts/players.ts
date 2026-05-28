import { z } from "zod";

import { apiResponseSchema, paginatedSchema, paginationQuerySchema } from "@/contracts/api";

export const playerSortSchema = z.enum(["name", "age", "position", "team", "updated"]);

export const playerListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  position: z.string().trim().max(8).optional(),
  team: z.string().trim().max(8).optional(),
  status: z.string().trim().max(32).optional(),
  sort: playerSortSchema.default("name"),
  dir: z.enum(["asc", "desc"]).default("asc"),
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
  sourceUpdatedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const playersResponseSchema = apiResponseSchema(paginatedSchema(playerSchema));
export const playerResponseSchema = apiResponseSchema(playerSchema);

export type PlayerListQuery = z.infer<typeof playerListQuerySchema>;
export type PlayerSummary = z.infer<typeof playerSchema>;
