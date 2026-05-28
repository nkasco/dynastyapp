import { playerListQuerySchema } from "@/contracts/players";
import { apiOk, handleApiError } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { listPlayers } from "@/server/players/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const url = new URL(request.url);
    const query = playerListQuerySchema.parse(Object.fromEntries(url.searchParams));
    return apiOk(await listPlayers(query));
  } catch (error) {
    return handleApiError(error);
  }
}
