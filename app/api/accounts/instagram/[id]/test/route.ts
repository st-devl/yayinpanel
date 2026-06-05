import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { testInstagramConnection } from "@/lib/server/account-connections";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const result = await testInstagramConnection(id);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
