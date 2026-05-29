import { apiOk, handleApiError } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { triggerNightlyRefresh } from "@/server/imports/service";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireApiUser();
    return apiOk(await triggerNightlyRefresh(), 202);
  } catch (error) {
    return handleApiError(error);
  }
}
