import { z } from "zod";

import { apiResponseSchema } from "@/contracts/api";

export const watchlistQuerySchema = z.object({
  leagueId: z.string().trim().min(1).max(128),
});

export const watchlistPlayerRequestSchema = z.object({
  leagueId: z.string().trim().min(1).max(128),
  sleeperPlayerId: z.string().trim().min(1).max(64),
});

export const watchlistItemSchema = z.object({
  id: z.string(),
  leagueId: z.string(),
  sleeperPlayerId: z.string(),
  fullName: z.string(),
  position: z.string().nullable(),
  team: z.string().nullable(),
  status: z.string().nullable(),
  age: z.number().nullable(),
  createdAt: z.string(),
});

export const watchlistSchema = z.object({
  leagueId: z.string(),
  items: z.array(watchlistItemSchema),
});

export const removedWatchlistItemSchema = z.object({
  leagueId: z.string(),
  sleeperPlayerId: z.string(),
  removed: z.boolean(),
});

export const watchlistResponseSchema = apiResponseSchema(watchlistSchema);
export const watchlistItemResponseSchema = apiResponseSchema(watchlistItemSchema);
export const removedWatchlistItemResponseSchema = apiResponseSchema(removedWatchlistItemSchema);

export type WatchlistQuery = z.infer<typeof watchlistQuerySchema>;
export type WatchlistPlayerRequest = z.infer<typeof watchlistPlayerRequestSchema>;
export type Watchlist = z.infer<typeof watchlistSchema>;
export type WatchlistItem = z.infer<typeof watchlistItemSchema>;
