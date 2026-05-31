import type { z } from "zod";

import {
  createNflverseImportRequestSchema,
  createSleeperImportRequestSchema,
  evaluateTradeRequestSchema,
  deleteLeagueResponseSchema,
  importJobResponseSchema,
  importJobsResponseSchema,
  leagueResponseSchema,
  leaguePreviewQuerySchema,
  leaguePreviewResponseSchema,
  leaguesResponseSchema,
  linkLeagueRequestSchema,
  linkLeagueResponseSchema,
  meResponseSchema,
  playerResponseSchema,
  playersResponseSchema,
  tradeEvaluationResponseSchema,
  updateLeagueSettingsRequestSchema,
  removedWatchlistItemResponseSchema,
  type ApiFailure,
  type CreateNflverseImportRequest,
  type CreateSleeperImportRequest,
  type EvaluateTradeRequest,
  type LinkLeagueRequest,
  type LeagueListQuery,
  type LeaguePreviewQuery,
  type PlayerListQuery,
  type UpdateLeagueSettingsRequest,
  type WatchlistPlayerRequest,
  watchlistItemResponseSchema,
  watchlistPlayerRequestSchema,
  watchlistQuerySchema,
  watchlistResponseSchema,
} from "@/contracts";

type ApiData<TSchema extends z.ZodType> = Extract<z.output<TSchema>, { ok: true }> extends { data: infer TData }
  ? TData
  : never;

export class ApiClientError extends Error {
  constructor(public readonly error: ApiFailure["error"]) {
    super(error.message);
  }
}

function queryString(query?: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

async function apiFetch<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
  init?: RequestInit,
): Promise<ApiData<TSchema>> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = schema.parse(await response.json()) as z.output<TSchema>;

  if ((payload as { ok: boolean }).ok === false) {
    throw new ApiClientError((payload as ApiFailure).error);
  }

  return (payload as { data: ApiData<TSchema> }).data;
}

function body<TInput>(schema: z.ZodType<TInput>, input: TInput) {
  return JSON.stringify(schema.parse(input));
}

export const apiClient = {
  me: () => apiFetch("/api/me", meResponseSchema),
  players: (query?: Partial<PlayerListQuery>) => apiFetch(`/api/players${queryString(query)}`, playersResponseSchema),
  player: (id: string) => apiFetch(`/api/players/${encodeURIComponent(id)}`, playerResponseSchema),
  leagues: (query?: Partial<LeagueListQuery>) => apiFetch(`/api/leagues${queryString(query)}`, leaguesResponseSchema),
  league: (id: string) => apiFetch(`/api/leagues/${encodeURIComponent(id)}`, leagueResponseSchema),
  deleteLeague: (id: string) =>
    apiFetch(`/api/leagues/${encodeURIComponent(id)}`, deleteLeagueResponseSchema, {
      method: "DELETE",
    }),
  updateLeagueSettings: (id: string, input: UpdateLeagueSettingsRequest) =>
    apiFetch(`/api/leagues/${encodeURIComponent(id)}`, leagueResponseSchema, {
      method: "PATCH",
      body: body(updateLeagueSettingsRequestSchema, input),
    }),
  leaguePreview: (query: LeaguePreviewQuery) =>
    apiFetch(`/api/leagues/preview${queryString(leaguePreviewQuerySchema.parse(query))}`, leaguePreviewResponseSchema),
  linkLeague: (input: LinkLeagueRequest) =>
    apiFetch("/api/leagues/link", linkLeagueResponseSchema, {
      method: "POST",
      body: body(linkLeagueRequestSchema, input),
    }),
  queueSleeperImport: (input: CreateSleeperImportRequest) =>
    apiFetch("/api/imports/sleeper", importJobResponseSchema, {
      method: "POST",
      body: body(createSleeperImportRequestSchema, input),
    }),
  queueNflverseImport: (input: CreateNflverseImportRequest) =>
    apiFetch("/api/imports/nflverse", importJobResponseSchema, {
      method: "POST",
      body: body(createNflverseImportRequestSchema, input),
    }),
  runQueuedImports: () =>
    apiFetch("/api/imports/run", importJobsResponseSchema, {
      method: "POST",
    }),
  triggerNightlyRefresh: () =>
    apiFetch("/api/imports/refresh", importJobResponseSchema, {
      method: "POST",
    }),
  importJob: (id: string) => apiFetch(`/api/imports/${encodeURIComponent(id)}`, importJobResponseSchema),
  evaluateTrade: (input: EvaluateTradeRequest) =>
    apiFetch("/api/trades/evaluate", tradeEvaluationResponseSchema, {
      method: "POST",
      body: body(evaluateTradeRequestSchema, input),
    }),
  watchlist: (leagueId: string) =>
    apiFetch(`/api/watchlists${queryString(watchlistQuerySchema.parse({ leagueId }))}`, watchlistResponseSchema),
  addWatchlistPlayer: (input: WatchlistPlayerRequest) =>
    apiFetch("/api/watchlists", watchlistItemResponseSchema, {
      method: "POST",
      body: body(watchlistPlayerRequestSchema, input),
    }),
  removeWatchlistPlayer: (input: WatchlistPlayerRequest) =>
    apiFetch(
      `/api/watchlists${queryString(watchlistPlayerRequestSchema.parse(input))}`,
      removedWatchlistItemResponseSchema,
      {
        method: "DELETE",
      },
    ),
};
