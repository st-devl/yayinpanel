"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setSessionCookie } from "@/lib/server/session";
import { prisma } from "@/lib/server/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type LoginActionState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
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
  redirect("/dashboard");
}
