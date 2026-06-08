import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getXOAuthCredentials,
  getXOAuthStatus
} from "@/lib/server/x-credentials";
import { prisma } from "@/lib/server/prisma";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    setting: {
      findMany: vi.fn()
    }
  }
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.ADMIN_PASSWORD = "short";
  process.env.X_CLIENT_ID = " client-id ";
  process.env.X_CLIENT_SECRET = " client-secret ";
  vi.mocked(prisma.setting.findMany).mockResolvedValue([]);
});

describe("X OAuth credential resolution", () => {
  it("uses X env values without validating unrelated bootstrap env", async () => {
    await expect(getXOAuthCredentials()).resolves.toEqual({
      clientId: "client-id",
      clientSecret: "client-secret"
    });
  });

  it("reports X env credentials as configured without full env validation", async () => {
    await expect(getXOAuthStatus()).resolves.toEqual({
      clientIdSet: true,
      clientSecretSet: true,
      source: "env"
    });
  });
});
