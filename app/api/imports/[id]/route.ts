import { apiOk, handleApiError } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { getImportJob } from "@/server/imports/service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    return apiOk(await getImportJob(id, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
