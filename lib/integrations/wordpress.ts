import "server-only";

import { buildBasicAuth } from "@/lib/publishers/wordpress-publisher";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";

/**
 * WordPress baglantisini /users/me ile dogrular.
 * Application password ile temel kimlik dogrulama yapilir.
 */
export async function verifyWordPressConnection(input: {
  baseUrl: string;
  username: string;
  applicationPassword: string;
}): Promise<{ ok: boolean; status: number; message?: string; name?: string }> {
  const baseUrl = input.baseUrl.replace(/\/+$/, "");
  const response = await fetchWithTimeout(
    `${baseUrl}/wp-json/wp/v2/users/me?context=edit`,
    {
      headers: {
        Authorization: buildBasicAuth(input.username, input.applicationPassword)
      }
    }
  );
  const result = await readJsonResponse(response);

  if (!result.ok) {
    const body = result.json as { message?: string };
    return {
      ok: false,
      status: result.status,
      message: body?.message ?? "WordPress baglantisi dogrulanamadi"
    };
  }

  return {
    ok: true,
    status: result.status,
    name: (result.json as { name?: string })?.name
  };
}
