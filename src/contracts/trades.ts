import { z } from "zod";

import { apiResponseSchema } from "@/contracts/api";

export const tradeAssetRequestSchema = z.discriminatedUnion("assetType", [
  z.object({
    assetType: z.literal("player"),
    sleeperPlayerId: z.string().min(1),
  }),
  z.object({
    assetType: z.literal("pick"),
    season: z.number().int().min(2020).max(2100),
    round: z.number().int().min(1).max(8),
  }),
]);

export const evaluateTradeRequestSchema = z.object({
  leagueId: z.string().optional(),
  give: z.array(tradeAssetRequestSchema).min(1),
  get: z.array(tradeAssetRequestSchema).min(1),
});

export const tradeEvaluationSchema = z.object({
  posture: z.enum(["strong", "balanced", "risky", "lopsided"]),
  summary: z.string(),
  factors: z.array(
    z.object({
      label: z.string(),
      detail: z.string(),
      impact: z.enum(["positive", "neutral", "negative"]),
    }),
  ),
});

export const tradeEvaluationResponseSchema = apiResponseSchema(tradeEvaluationSchema);

export type EvaluateTradeRequest = z.infer<typeof evaluateTradeRequestSchema>;
export type TradeEvaluation = z.infer<typeof tradeEvaluationSchema>;
