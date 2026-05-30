import { updateLeagueSettingsRequestSchema } from "@/contracts/leagues";
import { apiOk, handleApiError, readJson } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { deleteLeagueById, getLeagueById, updateLeagueSettings } from "@/server/leagues/service";

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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const input = updateLeagueSettingsRequestSchema.parse(await readJson(request));
    return apiOk(await updateLeagueSettings(id, input, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    return apiOk(await deleteLeagueById(id, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
