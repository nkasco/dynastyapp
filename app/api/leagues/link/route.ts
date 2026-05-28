import { linkLeagueRequestSchema } from "@/contracts/leagues";
import { apiOk, handleApiError, readJson } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { queueLeagueLink } from "@/server/leagues/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const input = linkLeagueRequestSchema.parse(await readJson(request));
    return apiOk(await queueLeagueLink(input), 202);
  } catch (error) {
    return handleApiError(error);
  }
}
