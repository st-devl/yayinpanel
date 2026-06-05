import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { getSystemStatus } from "@/lib/server/system-status";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  return NextResponse.json({ data: await getSystemStatus() });
}
