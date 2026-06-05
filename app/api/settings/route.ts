import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { getAllSettings, updateSetting } from "@/lib/server/settings";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  return NextResponse.json({ data: await getAllSettings() });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Gecersiz govde" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Gecersiz govde" }, { status: 400 });
  }

  const results = [];
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    results.push(await updateSetting(key, value));
  }

  const hasError = results.some((result) => !result.ok);

  return NextResponse.json(
    { results, data: await getAllSettings() },
    { status: hasError ? 400 : 200 }
  );
}
