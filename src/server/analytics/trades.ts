import "server-only";

import type { EvaluateTradeRequest } from "@/contracts/trades";

function assetWeight(asset: EvaluateTradeRequest["give"][number]) {
  if (asset.assetType === "player") {
    return 10;
  }

  return Math.max(2, 10 - asset.round * 1.5);
}

export async function evaluateTrade(input: EvaluateTradeRequest) {
  const giveScore = input.give.reduce((total, asset) => total + assetWeight(asset), 0);
  const getScore = input.get.reduce((total, asset) => total + assetWeight(asset), 0);
  const gap = getScore - giveScore;

  const posture =
    Math.abs(gap) <= 2 ? "balanced" : gap > 6 ? "strong" : gap < -6 ? "lopsided" : "risky";

  return {
    posture,
    summary:
      "Early trade evaluation is intentionally explainable and conservative until imported production, age, scarcity, and roster-fit data are available.",
    factors: [
      {
        label: "Asset count",
        detail: `Giving ${input.give.length} asset(s) and getting ${input.get.length} asset(s).`,
        impact: Math.abs(input.get.length - input.give.length) <= 1 ? "neutral" : input.get.length > input.give.length ? "positive" : "negative",
      },
      {
        label: "Pick liquidity",
        detail: "Draft picks receive simple round-based weight until pick inventory and league context are imported.",
        impact: "neutral",
      },
      {
        label: "Data confidence",
        detail: "Phase 4 verifies the API boundary; later phases add production, age curve, scarcity, and roster-fit evidence.",
        impact: "neutral",
      },
    ],
  } as const;
}
