import { afterEach, describe, expect, it } from "vitest";
import { EnvValidationError, getEnv } from "@/lib/server/env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function setCoreEnv() {
  process.env.DATABASE_URL = "file:./dev.db";
  process.env.APP_BASE_URL = "https://yayinpanel.cloud";
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  process.env.STORAGE_DIR = "storage";
  delete process.env.TIMEZONE;
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
}

describe("environment validation", () => {
  it("allows startup without admin bootstrap env after first-run setup", () => {
    setCoreEnv();

    const env = getEnv();

    expect(env.TIMEZONE).toBe("Europe/Istanbul");
    expect(env.ADMIN_EMAIL).toBe("");
    expect(env.ADMIN_PASSWORD).toBe("");
  });

  it("still requires ENCRYPTION_KEY", () => {
    setCoreEnv();
    delete process.env.ENCRYPTION_KEY;

    expect(() => getEnv()).toThrow(EnvValidationError);
  });
});
