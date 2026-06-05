import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { listPendingBatches } from "@/lib/server/processing-batches";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const batches = await listPendingBatches();
  return NextResponse.json({ data: batches });
}
