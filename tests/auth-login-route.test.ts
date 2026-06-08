import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/login/route";
import { createSessionCookie } from "@/lib/server/session";
import { prisma } from "@/lib/server/prisma";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("@/lib/server/session", () => ({
  createSessionCookie: vi.fn(async () => ({
    name: "patlat_session",
    options: {
      httpOnly: true,
      maxAge: 60,
      path: "/",
      sameSite: "lax",
      secure: true
    },
    value: "session-token"
  }))
}));

describe("login API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets a session cookie for valid credentials", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      createdAt: new Date(),
      email: "admin@example.com",
      id: "user-1",
      passwordHash: bcrypt.hashSync("secret-pass", 12),
      updatedAt: new Date()
    });

    const response = await POST(
      new NextRequest("https://yayinpanel.cloud/api/auth/login", {
        body: JSON.stringify({
          email: "admin@example.com",
          password: "secret-pass"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "patlat_session=session-token"
    );
    expect(createSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", email: "admin@example.com" })
    );
  });

  it("rejects invalid credentials without setting a cookie", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      createdAt: new Date(),
      email: "admin@example.com",
      id: "user-1",
      passwordHash: bcrypt.hashSync("secret-pass", 12),
      updatedAt: new Date()
    });

    const response = await POST(
      new NextRequest("https://yayinpanel.cloud/api/auth/login", {
        body: JSON.stringify({
          email: "admin@example.com",
          password: "wrong-pass"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: "E-posta veya şifre hatalı."
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(createSessionCookie).not.toHaveBeenCalled();
  });
});
