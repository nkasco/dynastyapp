import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL_ERROR",
  "NOT_IMPLEMENTED",
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export const apiMetaSchema = z.object({
  requestId: z.string(),
});

export function apiSuccessSchema<TData extends z.ZodType>(data: TData) {
  return z.object({
    ok: z.literal(true),
    data,
    meta: apiMetaSchema,
  });
}

export const apiFailureSchema = z.object({
  ok: z.literal(false),
  error: apiErrorSchema,
  meta: apiMetaSchema,
});

export function apiResponseSchema<TData extends z.ZodType>(data: TData) {
  return z.discriminatedUnion("ok", [apiSuccessSchema(data), apiFailureSchema]);
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  pageCount: z.number().int().min(0),
});

export function paginatedSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    items: z.array(item),
    pagination: paginationMetaSchema,
  });
}

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiFailure = z.infer<typeof apiFailureSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
