import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionCookie } from "@/lib/server/session";
import { prisma } from "@/lib/server/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function invalidLoginResponse() {
  return NextResponse.json(
    { error: "E-posta veya şifre hatalı." },
    { status: 401 }
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidLoginResponse();
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return invalidLoginResponse();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email }
    });

    if (!user) {
      return invalidLoginResponse();
    }

    const validPassword = await bcrypt.compare(
      parsed.data.password,
      user.passwordHash
    );

    if (!validPassword) {
      return invalidLoginResponse();
    }

    const sessionCookie = await createSessionCookie(user);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.options
    );

    return response;
  } catch (error) {
    console.error("Login API failed", error);
    return NextResponse.json(
      {
        error:
          "Giriş sırasında oturum oluşturulamadı. Sunucu ayarlarını kontrol edin."
      },
      { status: 500 }
    );
  }
}
