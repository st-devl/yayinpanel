import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null
    };
  }

  return { response: null, user };
}
