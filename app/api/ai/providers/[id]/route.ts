import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AIProviderType } from "@prisma/client";
import { requireApiUser } from "@/lib/server/api-auth";
import {
  deleteAIProvider,
  updateAIProvider
} from "@/lib/server/ai-providers";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  providerType: z.nativeEnum(AIProviderType).optional(),
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  baseUrl: z.string().url().optional().or(z.literal("")).optional(),
  maxTokens: z.number().int().positive().nullable().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  monthlyBudgetUsd: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional()
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz veri", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await updateAIProvider(id, {
      ...parsed.data,
      baseUrl:
        parsed.data.baseUrl !== undefined
          ? parsed.data.baseUrl || null
          : undefined
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Güncelleme başarısız" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    await deleteAIProvider(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Silme başarısız" },
      { status: 400 }
    );
  }
}
