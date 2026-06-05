import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import { getXRedirectUri } from "@/lib/integrations/x-oauth";
import {
  getXOAuthStatus,
  setXOAuthCredentials
} from "@/lib/server/x-credentials";

const updateSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional()
});

/** X OAuth istemci bilgisi durumu (degerler asla geri donmez) + callback URL. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  return NextResponse.json({
    data: { ...(await getXOAuthStatus()), redirectUri: getXRedirectUri() }
  });
}

/** Admin panelden X Client ID / Secret kaydeder. Bos alan degeri korur. */
export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Gecersiz govde" }, { status: 400 });
  }

  await setXOAuthCredentials(parsed.data);

  return NextResponse.json({
    data: { ...(await getXOAuthStatus()), redirectUri: getXRedirectUri() }
  });
}
