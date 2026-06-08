"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { setSessionCookie } from "@/lib/server/session";
import { prisma } from "@/lib/server/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type LoginActionState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  try {
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password")
    });

    if (!parsed.success) {
      return { error: "E-posta veya şifre hatalı." };
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email }
    });

    if (!user) {
      return { error: "E-posta veya şifre hatalı." };
    }

    const validPassword = await bcrypt.compare(
      parsed.data.password,
      user.passwordHash
    );

    if (!validPassword) {
      return { error: "E-posta veya şifre hatalı." };
    }

    await setSessionCookie(user);

    return { success: true };
  } catch (error) {
    console.error("Login action failed", error);
    return {
      error:
        "Giriş sırasında oturum oluşturulamadı. Sunucu ayarlarını kontrol edin."
    };
  }
}
