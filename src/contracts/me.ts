import { z } from "zod";

import { apiResponseSchema } from "@/contracts/api";

export const meSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  role: z.enum(["admin", "member"]),
});

export const meResponseSchema = apiResponseSchema(meSchema);

export type Me = z.infer<typeof meSchema>;
