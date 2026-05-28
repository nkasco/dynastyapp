import { createNflverseImportRequestSchema } from "@/contracts/imports";
import { apiOk, handleApiError, readJson } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { queueNflverseImport } from "@/server/imports/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const input = createNflverseImportRequestSchema.parse(await readJson(request));
    return apiOk(await queueNflverseImport(input), 202);
  } catch (error) {
    return handleApiError(error);
  }
}
