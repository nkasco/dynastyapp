import { readFile } from "node:fs/promises";

import { handleApiError } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import { playerImagePath } from "@/server/players/images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await params;
    const normalizedId = id.replace(/\.png$/i, "");
    const filePath = playerImagePath(normalizedId);

    if (!filePath) {
      return new Response(null, { status: 404 });
    }

    const image = await readFile(filePath);

    return new Response(image, {
      headers: {
        "cache-control": "private, max-age=86400",
        "content-type": "image/png",
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return new Response(null, { status: 404 });
    }

    return handleApiError(error);
  }
}
