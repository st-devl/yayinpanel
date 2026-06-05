import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  STORAGE_DIR: z.string().min(1).default("storage"),
  TIMEZONE: z.string().default("Europe/Istanbul"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, "ENCRYPTION_KEY must be 32 bytes hex"),
  META_APP_ID: z.string().optional().default(""),
  META_APP_SECRET: z.string().optional().default(""),
  X_CLIENT_ID: z.string().optional().default(""),
  X_CLIENT_SECRET: z.string().optional().default(""),
  X_API_KEY: z.string().optional().default(""),
  X_API_SECRET: z.string().optional().default(""),
  SCHEDULER_SECRET: z.string().optional().default(""),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_CHAT_ID: z.string().optional().default("")
});

export type AppEnv = z.infer<typeof envSchema>;

const envHints: Record<keyof AppEnv, string> = {
  DATABASE_URL: "Set DATABASE_URL to the Prisma datasource URL.",
  APP_BASE_URL: "Set APP_BASE_URL to the public URL of the app.",
  STORAGE_DIR: "Set STORAGE_DIR to the local media storage directory.",
  TIMEZONE:
    "Set TIMEZONE to a valid IANA timezone, for example Europe/Istanbul.",
  ADMIN_EMAIL: "Set ADMIN_EMAIL to the initial admin email address.",
  ADMIN_PASSWORD: "Set ADMIN_PASSWORD to a strong initial admin password.",
  ENCRYPTION_KEY:
    "Set ENCRYPTION_KEY to a 64-character hex value and keep it backed up.",
  META_APP_ID: "Set META_APP_ID when Instagram integration is enabled.",
  META_APP_SECRET: "Set META_APP_SECRET when Instagram integration is enabled.",
  X_CLIENT_ID: "Set X_CLIENT_ID when X OAuth integration is enabled.",
  X_CLIENT_SECRET: "Set X_CLIENT_SECRET when X OAuth integration is enabled.",
  X_API_KEY: "Set X_API_KEY when X API integration is enabled.",
  X_API_SECRET: "Set X_API_SECRET when X API integration is enabled.",
  SCHEDULER_SECRET:
    "Set SCHEDULER_SECRET to allow system cron to trigger scheduler ticks.",
  TELEGRAM_BOT_TOKEN:
    "Set TELEGRAM_BOT_TOKEN when Telegram notifications are enabled.",
  TELEGRAM_CHAT_ID:
    "Set TELEGRAM_CHAT_ID when Telegram notifications are enabled."
};

export class EnvValidationError extends Error {
  constructor(issues: string[]) {
    super(`Environment configuration is invalid:\n${issues.join("\n")}`);
    this.name = "EnvValidationError";
  }
}

function formatEnvIssue(issue: z.ZodIssue) {
  const key = issue.path[0]?.toString() as keyof AppEnv | undefined;
  const label = key ?? "ENV";
  const hint = key ? envHints[key] : "Check the environment configuration.";

  return `- ${label}: ${issue.message}. ${hint}`;
}

export function getEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new EnvValidationError(parsed.error.issues.map(formatEnvIssue));
  }

  return parsed.data;
}
