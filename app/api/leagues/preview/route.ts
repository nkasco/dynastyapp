import { leaguePreviewQuerySchema } from "@/contracts/leagues";
import { apiOk, handleApiError } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { previewLeagueLink } from "@/server/leagues/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const input = leaguePreviewQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return apiOk(await previewLeagueLink(input));
  } catch (error) {
    return handleApiError(error);
  }
}

