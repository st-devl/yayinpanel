import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { prisma } from "@/lib/server/prisma";

const CLIENT_ID_KEY = "integration.x.clientId";
const CLIENT_SECRET_KEY = "integration.x.clientSecret";

export type XOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

function clean(value: string): string {
  // API header'da kullanilacagi icin ASCII disi / kontrol karakterlerini ve
  // bostuk bosluklari temizle (kopyala-yapistir kaynakli bozulmalara karsi).
  return value.replace(/[^\x21-\x7E]/g, "");
}

function readEnvCredential(key: "X_CLIENT_ID" | "X_CLIENT_SECRET") {
  return process.env[key]?.trim() ?? "";
}

/**
 * X OAuth2 istemci bilgilerini cozumler: once veritabani (admin panelden
 * girilen) degerleri, yoksa env (X_CLIENT_ID / X_CLIENT_SECRET) kullanilir.
 */
export async function getXOAuthCredentials(): Promise<XOAuthCredentials> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [CLIENT_ID_KEY, CLIENT_SECRET_KEY] } }
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const clientId =
    byKey.get(CLIENT_ID_KEY)?.trim() || readEnvCredential("X_CLIENT_ID");

  const encryptedSecret = byKey.get(CLIENT_SECRET_KEY);
  const clientSecret = encryptedSecret
    ? decryptSecret(encryptedSecret)
    : readEnvCredential("X_CLIENT_SECRET");

  return { clientId: clean(clientId), clientSecret: clean(clientSecret) };
}

/** Admin panel/UI icin: anahtarlar tanimli mi (deger asla geri donmez). */
export async function getXOAuthStatus(): Promise<{
  clientIdSet: boolean;
  clientSecretSet: boolean;
  source: "database" | "env" | "none";
}> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [CLIENT_ID_KEY, CLIENT_SECRET_KEY] } }
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const dbId = Boolean(byKey.get(CLIENT_ID_KEY)?.trim());
  const dbSecret = Boolean(byKey.get(CLIENT_SECRET_KEY));
  const envId = Boolean(readEnvCredential("X_CLIENT_ID"));
  const envSecret = Boolean(readEnvCredential("X_CLIENT_SECRET"));

  const source = dbId || dbSecret ? "database" : envId || envSecret ? "env" : "none";

  return {
    clientIdSet: dbId || envId,
    clientSecretSet: dbSecret || envSecret,
    source
  };
}

/**
 * Admin panelden gelen X istemci bilgilerini kaydeder. Bos birakilan alan
 * mevcut degeri degistirmez (secret'i her seferinde tekrar girmek gerekmez).
 */
export async function setXOAuthCredentials(input: {
  clientId?: string;
  clientSecret?: string;
}): Promise<void> {
  const clientId = input.clientId?.trim();
  const clientSecret = input.clientSecret?.trim();

  if (clientId !== undefined && clientId !== "") {
    await prisma.setting.upsert({
      where: { key: CLIENT_ID_KEY },
      update: { value: clientId },
      create: { key: CLIENT_ID_KEY, value: clientId }
    });
  }

  if (clientSecret !== undefined && clientSecret !== "") {
    const value = encryptSecret(clientSecret);
    await prisma.setting.upsert({
      where: { key: CLIENT_SECRET_KEY },
      update: { value },
      create: { key: CLIENT_SECRET_KEY, value }
    });
  }
}
