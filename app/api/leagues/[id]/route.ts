import { apiOk, handleApiError } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { getLeagueById } from "@/server/leagues/service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    return apiOk(await getLeagueById(id, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
