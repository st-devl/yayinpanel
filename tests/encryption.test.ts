import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { maskSensitiveValue, safeJsonStringify } from "@/lib/security/mask";

describe("encryption", () => {
  it("round-trips a secret value", () => {
    const value = "super-secret-access-token";
    const encrypted = encryptSecret(value);

    expect(encrypted).not.toContain(value);
    expect(encrypted.split(".")).toHaveLength(3);
    expect(decryptSecret(encrypted)).toBe(value);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");

    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });

  it("rejects malformed ciphertext", () => {
    expect(() => decryptSecret("not-valid")).toThrow();
  });
});

describe("mask", () => {
  it("masks sensitive keys", () => {
    const masked = maskSensitiveValue({
      access_token: "abc",
      nested: { refreshToken: "def", safe: "value" }
    }) as Record<string, unknown>;

    expect(masked.access_token).toBe("[masked]");
    expect((masked.nested as Record<string, unknown>).refreshToken).toBe(
      "[masked]"
    );
    expect((masked.nested as Record<string, unknown>).safe).toBe("value");
  });

  it("does not leak secrets in serialized output", () => {
    const json = safeJsonStringify({ password: "hunter2", id: 1 });
    expect(json).not.toContain("hunter2");
    expect(json).toContain('"id":1');
  });
});
