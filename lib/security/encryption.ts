import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getEnv } from "@/lib/server/env";

const algorithm = "aes-256-gcm";
const ivLength = 12;

function getKey() {
  return Buffer.from(getEnv().ENCRYPTION_KEY, "hex");
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptSecret(value: string): string {
  const [ivValue, authTagValue, encryptedValue] = value.split(".");

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Encrypted secret has invalid format");
  }

  const decipher = createDecipheriv(
    algorithm,
    getKey(),
    Buffer.from(ivValue, "base64url")
  );

  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
