import { meSchema } from "@/contracts/me";
import { requireApiUser } from "@/server/auth/api";
import { apiOk, handleApiError } from "@/server/api/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireApiUser();
    return apiOk(meSchema.parse(user));
  } catch (error) {
    return handleApiError(error);
  }
}
