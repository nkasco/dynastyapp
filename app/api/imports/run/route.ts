import { importJobsSchema } from "@/contracts/imports";
import { apiOk, handleApiError } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { runQueuedImports } from "@/server/imports/service";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireApiUser();
    const jobs = await runQueuedImports();
    return apiOk(importJobsSchema.parse(jobs), 202);
  } catch (error) {
    return handleApiError(error);
  }
}
