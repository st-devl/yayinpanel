import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "@/lib/server/env";

function createMediaAccessToken(mediaId: string, expiresAt: number) {
  const secret = Buffer.from(getEnv().ENCRYPTION_KEY, "hex");
  const payload = `${mediaId}.${expiresAt}`;
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${expiresAt}.${signature}`;
}

export function verifyMediaAccessToken(mediaId: string, token: string | null) {
  if (!token) {
    return false;
  }

  const [expiresAtValue, signature] = token.split(".");
  const expiresAt = Number(expiresAtValue);

  if (
    !Number.isInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  const expected = createMediaAccessToken(mediaId, expiresAt).split(".")[1];

  if (!expected || !signature) {
    return false;
  }

  const expectedBytes = Buffer.from(expected, "base64url");
  const signatureBytes = Buffer.from(signature, "base64url");

  return (
    expectedBytes.length === signatureBytes.length &&
    timingSafeEqual(expectedBytes, signatureBytes)
  );
}

export function createSignedMediaFileUrl(
  mediaId: string,
  expiresInSeconds = 600
) {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const url = new URL(`/api/media/${mediaId}/file`, getEnv().APP_BASE_URL);

  url.searchParams.set("token", createMediaAccessToken(mediaId, expiresAt));

  return {
    expiresAt: new Date(expiresAt * 1000),
    url: url.toString()
  };
}
