import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/server/prisma";

/** Yonetilebilir ayar anahtarlari ve dogrulama semalari. */
export const settingDefinitions = {
  TIMEZONE: {
    label: "Zaman Dilimi",
    schema: z.string().min(1),
    default: "Europe/Istanbul"
  },
  IG_DAILY_POST_LIMIT: {
    label: "Instagram Gunluk Limit",
    schema: z.coerce.number().int().min(1).max(50),
    default: "10"
  },
  BACKUP_PATH: {
    label: "Yedekleme Klasoru",
    schema: z.string().min(1),
    default: "./backups"
  },
  TELEGRAM_ENABLED: {
    label: "Telegram Bildirimleri",
    schema: z.enum(["true", "false"]),
    default: "false"
  }
} as const;

export type SettingKey = keyof typeof settingDefinitions;

export const settingKeys = Object.keys(settingDefinitions) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return key in settingDefinitions;
}

export async function getAllSettings(): Promise<Record<SettingKey, string>> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: settingKeys } }
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return Object.fromEntries(
    settingKeys.map((key) => [
      key,
      byKey.get(key) ?? settingDefinitions[key].default
    ])
  ) as Record<SettingKey, string>;
}

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? settingDefinitions[key].default;
}

export type SettingUpdateResult =
  | { ok: true; key: SettingKey; value: string }
  | { ok: false; key: string; error: string };

/** Bir ayari dogrular ve kaydeder (upsert). */
export async function updateSetting(
  key: string,
  rawValue: unknown
): Promise<SettingUpdateResult> {
  if (!isSettingKey(key)) {
    return { ok: false, key, error: "Bilinmeyen ayar anahtari" };
  }

  const parsed = settingDefinitions[key].schema.safeParse(rawValue);

  if (!parsed.success) {
    return { ok: false, key, error: "Gecersiz ayar degeri" };
  }

  const value = String(parsed.data);
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });

  return { ok: true, key, value };
}
