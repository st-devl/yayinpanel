import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { getAIProviderCredentials } from "@/lib/server/ai-providers";
import { logUsage } from "@/lib/server/ai-usage";
import { buildProvider } from "@/lib/ai/provider-registry";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const credentials = await getAIProviderCredentials(id);

  if (!credentials) {
    return NextResponse.json({ error: "Sağlayıcı bulunamadı" }, { status: 404 });
  }

  try {
    const provider = buildProvider({
      providerType: credentials.providerType,
      apiKeyEncrypted: credentials.apiKeyEncrypted,
      model: credentials.model,
      baseUrl: credentials.baseUrl,
      timeoutSeconds: credentials.timeoutSeconds
    });

    const response = await provider.complete(
      [
        {
          role: "system",
          content: "Sadece geçerli JSON nesnesi döndür. Başka metin ekleme."
        },
        {
          role: "user",
          content: 'Merhaba. Bağlantı testiyim. Sadece bu JSON değerini döndür: {"ok":true}'
        }
      ],
      { maxTokens: 50 }
    );

    await logUsage({
      aiProviderId: id,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      purpose: "test"
    });

    return NextResponse.json({
      ok: true,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Bağlantı testi başarısız"
      },
      { status: 400 }
    );
  }
}
