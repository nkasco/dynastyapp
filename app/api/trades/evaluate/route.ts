import { evaluateTradeRequestSchema } from "@/contracts/trades";
import { apiOk, handleApiError, readJson } from "@/server/api/errors";
import { evaluateTrade } from "@/server/analytics/trades";
import { requireApiUser } from "@/server/auth/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const input = evaluateTradeRequestSchema.parse(await readJson(request));
    return apiOk(await evaluateTrade(input));
  } catch (error) {
    return handleApiError(error);
  }
}
