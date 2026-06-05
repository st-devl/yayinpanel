import "server-only";

import { ConnectionStatus, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { prisma } from "@/lib/server/prisma";

export const instagramAccountSafeSelect = {
  id: true,
  accountName: true,
  username: true,
  instagramBusinessAccountId: true,
  facebookPageId: true,
  profileImageUrl: true,
  tokenExpiresAt: true,
  connectionStatus: true,
  lastError: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.InstagramAccountSelect;

export const xAccountSafeSelect = {
  id: true,
  accountName: true,
  username: true,
  xUserId: true,
  profileImageUrl: true,
  tokenExpiresAt: true,
  connectionStatus: true,
  lastError: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.XAccountSelect;

export const wordPressSiteSafeSelect = {
  id: true,
  name: true,
  baseUrl: true,
  username: true,
  connectionStatus: true,
  lastError: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.WordPressSiteSelect;

export const customSiteSafeSelect = {
  id: true,
  name: true,
  baseUrl: true,
  connectionStatus: true,
  lastError: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.CustomSiteSelect;

export type SafeInstagramAccount = Prisma.InstagramAccountGetPayload<{
  select: typeof instagramAccountSafeSelect;
}>;

export type SafeXAccount = Prisma.XAccountGetPayload<{
  select: typeof xAccountSafeSelect;
}>;

export type SafeWordPressSite = Prisma.WordPressSiteGetPayload<{
  select: typeof wordPressSiteSafeSelect;
}>;

export type SafeCustomSite = Prisma.CustomSiteGetPayload<{
  select: typeof customSiteSafeSelect;
}>;

export type CreateInstagramAccountInput = {
  accountName: string;
  username: string;
  instagramBusinessAccountId: string;
  facebookPageId: string;
  accessToken: string;
  profileImageUrl?: string | null;
  tokenExpiresAt?: Date | null;
  connectionStatus?: ConnectionStatus;
  lastError?: string | null;
};

export type CreateXAccountInput = {
  accountName: string;
  username: string;
  xUserId: string;
  accessToken: string;
  refreshToken?: string | null;
  profileImageUrl?: string | null;
  tokenExpiresAt?: Date | null;
  connectionStatus?: ConnectionStatus;
  lastError?: string | null;
};

export type CreateWordPressSiteInput = {
  name: string;
  baseUrl: string;
  username: string;
  applicationPassword: string;
  connectionStatus?: ConnectionStatus;
  lastError?: string | null;
};

export type CreateCustomSiteInput = {
  name: string;
  baseUrl: string;
  apiKey: string;
  connectionStatus?: ConnectionStatus;
  lastError?: string | null;
};

function normalizeSecret(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  return normalized;
}

/**
 * Sosyal medya kullanıcı adını saklamaya hazırlar: baştaki "@" işaret(ler)ini
 * ve boşlukları temizler. Uygulama gösterimde "@" ekini kendisi eklediği için
 * burada "@" saklanırsa "@@kullanici" gibi çift işaret oluşur. Bu, tüm yazma
 * yollarını koruyan yetkili tek noktadır.
 */
function normalizeHandle(value: string) {
  const normalized = value.trim().replace(/^@+/, "");

  if (!normalized) {
    throw new Error("username is required");
  }

  return normalized;
}

function rejectEncryptedInput(input: Record<string, unknown>) {
  const encryptedKeys = Object.keys(input).filter((key) =>
    key.endsWith("Encrypted")
  );

  if (encryptedKeys.length > 0) {
    throw new Error(
      `Encrypted credential fields are managed by account credential services: ${encryptedKeys.join(", ")}`
    );
  }
}

export async function createInstagramAccount(
  input: CreateInstagramAccountInput
): Promise<SafeInstagramAccount> {
  rejectEncryptedInput(input as Record<string, unknown>);

  return prisma.instagramAccount.create({
    data: {
      accountName: input.accountName,
      username: normalizeHandle(input.username),
      instagramBusinessAccountId: input.instagramBusinessAccountId,
      facebookPageId: input.facebookPageId,
      profileImageUrl: input.profileImageUrl,
      accessTokenEncrypted: encryptSecret(
        normalizeSecret(input.accessToken, "Instagram access token")
      ),
      tokenExpiresAt: input.tokenExpiresAt,
      connectionStatus: input.connectionStatus ?? ConnectionStatus.CONNECTED,
      lastError: input.lastError
    },
    select: instagramAccountSafeSelect
  });
}

export async function updateInstagramAccessToken(
  accountId: string,
  accessToken: string,
  tokenExpiresAt?: Date | null
): Promise<SafeInstagramAccount> {
  return prisma.instagramAccount.update({
    where: { id: accountId },
    data: {
      accessTokenEncrypted: encryptSecret(
        normalizeSecret(accessToken, "Instagram access token")
      ),
      tokenExpiresAt,
      connectionStatus: ConnectionStatus.CONNECTED,
      lastError: null
    },
    select: instagramAccountSafeSelect
  });
}

export async function getInstagramAccessToken(accountId: string) {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
    select: { accessTokenEncrypted: true }
  });

  return account ? decryptSecret(account.accessTokenEncrypted) : null;
}

export async function createXAccount(
  input: CreateXAccountInput
): Promise<SafeXAccount> {
  rejectEncryptedInput(input as Record<string, unknown>);

  return prisma.xAccount.create({
    data: {
      accountName: input.accountName,
      username: normalizeHandle(input.username),
      xUserId: input.xUserId,
      profileImageUrl: input.profileImageUrl,
      accessTokenEncrypted: encryptSecret(
        normalizeSecret(input.accessToken, "X access token")
      ),
      refreshTokenEncrypted: input.refreshToken
        ? encryptSecret(normalizeSecret(input.refreshToken, "X refresh token"))
        : null,
      tokenExpiresAt: input.tokenExpiresAt,
      connectionStatus: input.connectionStatus ?? ConnectionStatus.CONNECTED,
      lastError: input.lastError
    },
    select: xAccountSafeSelect
  });
}

export async function updateXTokens(
  accountId: string,
  input: {
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiresAt?: Date | null;
  }
): Promise<SafeXAccount> {
  return prisma.xAccount.update({
    where: { id: accountId },
    data: {
      accessTokenEncrypted: encryptSecret(
        normalizeSecret(input.accessToken, "X access token")
      ),
      refreshTokenEncrypted:
        input.refreshToken === undefined
          ? undefined
          : input.refreshToken
            ? encryptSecret(
                normalizeSecret(input.refreshToken, "X refresh token")
              )
            : null,
      tokenExpiresAt: input.tokenExpiresAt,
      connectionStatus: ConnectionStatus.CONNECTED,
      lastError: null
    },
    select: xAccountSafeSelect
  });
}

export async function getXTokens(accountId: string) {
  const account = await prisma.xAccount.findUnique({
    where: { id: accountId },
    select: {
      accessTokenEncrypted: true,
      refreshTokenEncrypted: true
    }
  });

  if (!account) {
    return null;
  }

  return {
    accessToken: decryptSecret(account.accessTokenEncrypted),
    refreshToken: account.refreshTokenEncrypted
      ? decryptSecret(account.refreshTokenEncrypted)
      : null
  };
}

export async function createWordPressSite(
  input: CreateWordPressSiteInput
): Promise<SafeWordPressSite> {
  rejectEncryptedInput(input as Record<string, unknown>);

  return prisma.wordPressSite.create({
    data: {
      name: input.name,
      baseUrl: input.baseUrl,
      username: input.username,
      applicationPasswordEncrypted: encryptSecret(
        normalizeSecret(
          input.applicationPassword,
          "WordPress application password"
        )
      ),
      connectionStatus: input.connectionStatus ?? ConnectionStatus.CONNECTED,
      lastError: input.lastError
    },
    select: wordPressSiteSafeSelect
  });
}

export async function updateWordPressApplicationPassword(
  siteId: string,
  applicationPassword: string
): Promise<SafeWordPressSite> {
  return prisma.wordPressSite.update({
    where: { id: siteId },
    data: {
      applicationPasswordEncrypted: encryptSecret(
        normalizeSecret(applicationPassword, "WordPress application password")
      ),
      connectionStatus: ConnectionStatus.CONNECTED,
      lastError: null
    },
    select: wordPressSiteSafeSelect
  });
}

export async function getWordPressCredentials(siteId: string) {
  const site = await prisma.wordPressSite.findUnique({
    where: { id: siteId },
    select: {
      baseUrl: true,
      username: true,
      applicationPasswordEncrypted: true
    }
  });

  if (!site) {
    return null;
  }

  return {
    baseUrl: site.baseUrl,
    username: site.username,
    applicationPassword: decryptSecret(site.applicationPasswordEncrypted)
  };
}

export async function getWordPressApplicationPassword(siteId: string) {
  const credentials = await getWordPressCredentials(siteId);
  return credentials?.applicationPassword ?? null;
}

export async function setInstagramConnectionStatus(
  accountId: string,
  connectionStatus: ConnectionStatus,
  lastError: string | null = null
): Promise<SafeInstagramAccount> {
  return prisma.instagramAccount.update({
    where: { id: accountId },
    data: { connectionStatus, lastError },
    select: instagramAccountSafeSelect
  });
}

export async function setXConnectionStatus(
  accountId: string,
  connectionStatus: ConnectionStatus,
  lastError: string | null = null
): Promise<SafeXAccount> {
  return prisma.xAccount.update({
    where: { id: accountId },
    data: { connectionStatus, lastError },
    select: xAccountSafeSelect
  });
}

export async function setWordPressConnectionStatus(
  siteId: string,
  connectionStatus: ConnectionStatus,
  lastError: string | null = null
): Promise<SafeWordPressSite> {
  return prisma.wordPressSite.update({
    where: { id: siteId },
    data: { connectionStatus, lastError },
    select: wordPressSiteSafeSelect
  });
}

export async function createCustomSite(
  input: CreateCustomSiteInput
): Promise<SafeCustomSite> {
  rejectEncryptedInput(input as Record<string, unknown>);

  return prisma.customSite.create({
    data: {
      name: input.name,
      baseUrl: input.baseUrl,
      apiKeyEncrypted: encryptSecret(normalizeSecret(input.apiKey, "API key")),
      connectionStatus: input.connectionStatus ?? ConnectionStatus.CONNECTED,
      lastError: input.lastError
    },
    select: customSiteSafeSelect
  });
}

export async function updateCustomSiteApiKey(
  siteId: string,
  apiKey: string
): Promise<SafeCustomSite> {
  return prisma.customSite.update({
    where: { id: siteId },
    data: {
      apiKeyEncrypted: encryptSecret(normalizeSecret(apiKey, "API key")),
      connectionStatus: ConnectionStatus.CONNECTED,
      lastError: null
    },
    select: customSiteSafeSelect
  });
}

export async function getCustomSiteCredentials(siteId: string) {
  const site = await prisma.customSite.findUnique({
    where: { id: siteId },
    select: { baseUrl: true, apiKeyEncrypted: true }
  });

  if (!site) return null;

  return {
    baseUrl: site.baseUrl,
    apiKey: decryptSecret(site.apiKeyEncrypted)
  };
}

export async function setCustomSiteConnectionStatus(
  siteId: string,
  connectionStatus: ConnectionStatus,
  lastError: string | null = null
): Promise<SafeCustomSite> {
  return prisma.customSite.update({
    where: { id: siteId },
    data: { connectionStatus, lastError },
    select: customSiteSafeSelect
  });
}
