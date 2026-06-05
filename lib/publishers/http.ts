import "server-only";

import { normalizeUnknownError, transientError } from "@/lib/publishers/errors";

export type FetchJsonResult = {
  ok: boolean;
  status: number;
  json: unknown;
  text: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Zaman asimi kontrollu fetch. Ag/timeout hatalarini TRANSIENT olarak yukseltir.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw transientError(
        "REQUEST_TIMEOUT",
        `Istek zaman asimina ugradi: ${url}`
      );
    }

    throw normalizeUnknownError(error);
  } finally {
    clearTimeout(timer);
  }
}

/** Yaniti JSON olarak okur; JSON degilse ham metni de dondurur. */
export async function readJsonResponse(
  response: Response
): Promise<FetchJsonResult> {
  const text = await response.text();
  let json: unknown = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  return { ok: response.ok, status: response.status, json, text };
}
