import { apiOk, handleApiError } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { getPlayerById } from "@/server/players/service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await params;
    return apiOk(await getPlayerById(id));
  } catch (error) {
    return handleApiError(error);
  }
}
