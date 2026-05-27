import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value !== "false");

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Dynasty Command Center"),

    AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
    AUTH_GITHUB_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    AUTH_GITHUB_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    AUTH_DISCORD_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    AUTH_DISCORD_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    LOCAL_AUTH_ENABLED: booleanString.default(true),

    DATABASE_URL: z.string().min(1).default("file:./data/dynasty.db"),
    DATABASE_PATH: z.string().min(1).default("./data/dynasty.db"),

    IMPORT_TIME_ZONE: z.string().min(1).default("America/New_York"),
    IMPORT_NIGHTLY_CRON: z.string().min(1).default("0 1 * * *"),
    SLEEPER_BASE_URL: z.string().url().default("https://api.sleeper.app/v1"),
    NFLVERSE_BASE_URL: z
      .string()
      .url()
      .default("https://github.com/nflverse/nflverse-data/releases/download"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET must be set in production.",
      });
    }

    const githubPartials = [env.AUTH_GITHUB_ID, env.AUTH_GITHUB_SECRET].filter(Boolean).length;
    if (githubPartials === 1) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_GITHUB_ID"],
        message: "GitHub auth requires both AUTH_GITHUB_ID and AUTH_GITHUB_SECRET.",
      });
    }

    const discordPartials = [env.AUTH_DISCORD_ID, env.AUTH_DISCORD_SECRET].filter(Boolean).length;
    if (discordPartials === 1) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_DISCORD_ID"],
        message: "Discord auth requires both AUTH_DISCORD_ID and AUTH_DISCORD_SECRET.",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${errors}`);
}

export const env = parsed.data;
export type Env = typeof env;
export { envSchema };
