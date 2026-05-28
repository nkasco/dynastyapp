import { createSleeperImportRequestSchema } from "@/contracts/imports";
import { apiOk, handleApiError, readJson } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { queueSleeperImport } from "@/server/imports/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const input = createSleeperImportRequestSchema.parse(await readJson(request));
    return apiOk(await queueSleeperImport(input), 202);
  } catch (error) {
    return handleApiError(error);
  }
}
