export type ApiPayload = {
  error?: string;
};

function fallbackJsonError(response: Response, rawBody: string) {
  if (response.status === 401) {
    return "Oturum suresi dolmus olabilir. Sayfayi yenileyip tekrar giris yapin.";
  }

  if (response.status === 413) {
    return "Dosya boyutu sunucu yukleme limitini asiyor.";
  }

  if (response.status === 502 || response.status === 504) {
    return "Sunucudan zamaninda yanit alinamadi. Biraz sonra tekrar deneyin.";
  }

  if (!rawBody.trim()) {
    return `Sunucu bos yanit dondurdu (HTTP ${response.status}).`;
  }

  return `Sunucudan beklenen JSON yaniti alinamadi (HTTP ${response.status}).`;
}

export async function readJsonResponse<T = ApiPayload>(
  response: Response
): Promise<T> {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return {
      error: fallbackJsonError(response, rawBody)
    } as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return {
      error: fallbackJsonError(response, rawBody)
    } as T;
  }
}
