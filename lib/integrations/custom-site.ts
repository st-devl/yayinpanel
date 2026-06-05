import "server-only";

import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";

export async function verifyCustomSiteConnection(input: {
  baseUrl: string;
  apiKey: string;
}): Promise<{ ok: boolean; status: number; message?: string }> {
  const baseUrl = input.baseUrl.replace(/\/+$/, "");

  const response = await fetchWithTimeout(`${baseUrl}/api/patlat/ping`, {
    headers: { Authorization: `Bearer ${input.apiKey}` }
  });
  const result = await readJsonResponse(response);

  if (!result.ok) {
    const body = result.json as { message?: string; error?: string };
    return {
      ok: false,
      status: result.status,
      message: body?.message ?? body?.error ?? "Bağlantı doğrulanamadı"
    };
  }

  return { ok: true, status: result.status };
}
