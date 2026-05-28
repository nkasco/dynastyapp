import type { z } from "zod";

import {
  createNflverseImportRequestSchema,
  createSleeperImportRequestSchema,
  evaluateTradeRequestSchema,
  importJobResponseSchema,
  leagueResponseSchema,
  leaguesResponseSchema,
  linkLeagueRequestSchema,
  linkLeagueResponseSchema,
  meResponseSchema,
  playerResponseSchema,
  playersResponseSchema,
  tradeEvaluationResponseSchema,
  type ApiFailure,
  type CreateNflverseImportRequest,
  type CreateSleeperImportRequest,
  type EvaluateTradeRequest,
  type LinkLeagueRequest,
  type LeagueListQuery,
  type PlayerListQuery,
} from "@/contracts";

type ApiData<TSchema extends z.ZodType> = Extract<z.output<TSchema>, { ok: true }> extends { data: infer TData }
  ? TData
  : never;

export class ApiClientError extends Error {
  constructor(public readonly error: ApiFailure["error"]) {
    super(error.message);
  }
}

function queryString(query?: Record<string, string | number | undefined>) {
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
  importJob: (id: string) => apiFetch(`/api/imports/${encodeURIComponent(id)}`, importJobResponseSchema),
  evaluateTrade: (input: EvaluateTradeRequest) =>
    apiFetch("/api/trades/evaluate", tradeEvaluationResponseSchema, {
      method: "POST",
      body: body(evaluateTradeRequestSchema, input),
    }),
};
