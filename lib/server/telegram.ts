import "server-only";

import { getEnv } from "@/lib/server/env";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";

export type TelegramNotificationKind =
  | "PUBLISH_SUCCESS"
  | "PUBLISH_FAILED"
  | "TOKEN_EXPIRED"
  | "RECONNECT_REQUIRED"
  | "MANUAL_CHECK"
  | "RETRY_EXHAUSTED";

const titles: Record<TelegramNotificationKind, string> = {
  PUBLISH_SUCCESS: "✅ Yayin basarili",
  PUBLISH_FAILED: "❌ Yayin basarisiz",
  TOKEN_EXPIRED: "🔑 Token suresi doldu",
  RECONNECT_REQUIRED: "🔌 Yeniden baglanti gerekli",
  MANUAL_CHECK: "⚠️ Manuel kontrol gerekli",
  RETRY_EXHAUSTED: "🛑 Tekrar denemeler tukendi"
};

export type TelegramMessageInput = {
  kind: TelegramNotificationKind;
  /** Kisa, cozum odakli aciklama. */
  detail: string;
  /** Opsiyonel cozum onerisi. */
  action?: string;
};

/**
 * Telegram bildirimi gonderir. Token/chat id eksikse sessiz gecmez,
 * loglanmis bir uyari dondurur (throw etmez).
 */
export async function sendTelegramNotification(
  input: TelegramMessageInput
): Promise<{ sent: boolean; reason?: string }> {
  const env = getEnv();

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    const reason =
      "Telegram bildirimi atlandi: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID tanimli degil";
    console.warn(`[telegram] ${reason}`);
    return { sent: false, reason };
  }

  const text = [
    titles[input.kind],
    "",
    input.detail,
    input.action ? `\nNe yapmali: ${input.action}` : ""
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();

  try {
    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          disable_web_page_preview: true
        })
      }
    );
    const result = await readJsonResponse(response);

    if (!result.ok) {
      const reason = `Telegram API hatasi (${result.status})`;
      console.warn(`[telegram] ${reason}`);
      return { sent: false, reason };
    }

    return { sent: true };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Telegram gonderimi basarisiz";
    console.warn(`[telegram] ${reason}`);
    return { sent: false, reason };
  }
}
