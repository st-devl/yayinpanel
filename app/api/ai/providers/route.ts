import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AIProviderType } from "@prisma/client";
import { requireApiUser } from "@/lib/server/api-auth";
import { createAIProvider, getAIProviders } from "@/lib/server/ai-providers";

const createSchema = z.object({
  name: z.string().min(1),
  providerType: z.nativeEnum(AIProviderType),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  baseUrl: z.string().url().optional().or(z.literal("")),
  maxTokens: z.number().int().positive().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  monthlyBudgetUsd: z.number().positive().optional(),
  isDefault: z.boolean().optional()
});

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const providers = await getAIProviders();
  return NextResponse.json({ data: providers });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const parsed = createSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz veri", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const provider = await createAIProvider({
      ...parsed.data,
      baseUrl: parsed.data.baseUrl || null
    });
    return NextResponse.json({ data: provider }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sağlayıcı eklenemedi" },
      { status: 400 }
    );
  }
}
