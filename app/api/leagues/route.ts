import { leagueListQuerySchema } from "@/contracts/leagues";
import { apiOk, handleApiError } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { listLeagues } from "@/server/leagues/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const query = leagueListQuerySchema.parse(Object.fromEntries(url.searchParams));
    return apiOk(await listLeagues(query, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
