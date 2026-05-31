import { watchlistPlayerRequestSchema, watchlistQuerySchema } from "@/contracts/watchlists";
import { apiOk, handleApiError, readJson } from "@/server/api/errors";
import { requireApiUser } from "@/server/auth/api";
import {
  addWatchlistPlayer,
  listWatchlist,
  removeWatchlistPlayer,
} from "@/server/players/watchlist-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const query = watchlistQuerySchema.parse(Object.fromEntries(url.searchParams));
    return apiOk(await listWatchlist(query, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const input = watchlistPlayerRequestSchema.parse(await readJson(request));
    return apiOk(await addWatchlistPlayer(input, user.id), 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const input = watchlistPlayerRequestSchema.parse(Object.fromEntries(url.searchParams));
    return apiOk(await removeWatchlistPlayer(input, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
