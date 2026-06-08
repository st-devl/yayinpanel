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
  oauth1AccessToken?: string | null;
  oauth1AccessTokenSecret?: string | null;
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

async function findXAccountByReference(
  accountReference: string,
  options: { allowSingleAccountFallback?: boolean } = {}
) {
  const account = await prisma.xAccount.findFirst({
    where: {
      OR: [{ id: accountReference }, { xUserId: accountReference }]
    },
    select: {
      id: true,
      xUserId: true,
      tokenExpiresAt: true,
      accessTokenEncrypted: true,
      refreshTokenEncrypted: true,
      oauth1AccessTokenEncrypted: true,
      oauth1AccessTokenSecretEncrypted: true
    }
  });

  if (account || !options.allowSingleAccountFallback) {
    return account;
  }

  const fallbackAccounts = await prisma.xAccount.findMany({
    where: { connectionStatus: { not: ConnectionStatus.DISCONNECTED } },
    orderBy: { updatedAt: "desc" },
    take: 2,
    select: {
      id: true,
      xUserId: true,
      tokenExpiresAt: true,
      accessTokenEncrypted: true,
      refreshTokenEncrypted: true,
      oauth1AccessTokenEncrypted: true,
      oauth1AccessTokenSecretEncrypted: true
    }
  });

  return fallbackAccounts.length === 1 ? fallbackAccounts[0] : null;
}

async function resolveXAccountInternalId(accountReference: string) {
  const account = await findXAccountByReference(accountReference);
  return account?.id ?? null;
}

/**
 * X kartları yerel XAccount satır id'si yerine X'in kalıcı user id'sine
 * bağlanır. Eski iç id gönderilirse burada xUserId'ye normalize edilir.
 */
export async function resolveStableXAccountId(accountReference: string) {
  const account = await findXAccountByReference(accountReference);
  return account?.xUserId ?? null;
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
      oauth1AccessTokenEncrypted: input.oauth1AccessToken
        ? encryptSecret(
            normalizeSecret(input.oauth1AccessToken, "X OAuth1 access token")
          )
        : null,
      oauth1AccessTokenSecretEncrypted: input.oauth1AccessTokenSecret
        ? encryptSecret(
            normalizeSecret(
              input.oauth1AccessTokenSecret,
              "X OAuth1 access token secret"
            )
          )
        : null,
      tokenExpiresAt: input.tokenExpiresAt,
      connectionStatus: input.connectionStatus ?? ConnectionStatus.CONNECTED,
      lastError: input.lastError
    },
    select: xAccountSafeSelect
  });
}

/**
 * OAuth2 (PKCE) akisindan donen kullanici token'lariyla X hesabini olusturur ya
 * da gunceller. Ayni xUserId varsa token'lar yenilenir; yoksa yeni hesap acilir.
 */
export async function upsertXAccountFromOAuth(input: {
  xUserId: string;
  username: string;
  accountName?: string;
  accessToken: string;
  refreshToken?: string | null;
  oauth1AccessToken?: string | null;
  oauth1AccessTokenSecret?: string | null;
  tokenExpiresAt?: Date | null;
  profileImageUrl?: string | null;
}): Promise<SafeXAccount> {
  const accessTokenEncrypted = encryptSecret(
    normalizeSecret(input.accessToken, "X access token")
  );
  const refreshTokenEncrypted = input.refreshToken
    ? encryptSecret(normalizeSecret(input.refreshToken, "X refresh token"))
    : null;
  const oauth1AccessTokenEncrypted = input.oauth1AccessToken
    ? encryptSecret(
        normalizeSecret(input.oauth1AccessToken, "X OAuth1 access token")
      )
    : undefined;
  const oauth1AccessTokenSecretEncrypted = input.oauth1AccessTokenSecret
    ? encryptSecret(
        normalizeSecret(
          input.oauth1AccessTokenSecret,
          "X OAuth1 access token secret"
        )
      )
    : undefined;
  const username = input.username.trim().replace(/^@+/, "");

  const existing = await prisma.xAccount.findFirst({
    where: { xUserId: input.xUserId },
    select: { id: true }
  });

  if (existing) {
    return prisma.xAccount.update({
      where: { id: existing.id },
      data: {
        accountName: input.accountName?.trim() || undefined,
        username,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        oauth1AccessTokenEncrypted,
        oauth1AccessTokenSecretEncrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        profileImageUrl: input.profileImageUrl ?? undefined,
        connectionStatus: ConnectionStatus.CONNECTED,
        lastError: null
      },
      select: xAccountSafeSelect
    });
  }

  return prisma.xAccount.create({
    data: {
      accountName: input.accountName?.trim() || username,
      username,
      xUserId: input.xUserId,
      profileImageUrl: input.profileImageUrl ?? null,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      oauth1AccessTokenEncrypted: oauth1AccessTokenEncrypted ?? null,
      oauth1AccessTokenSecretEncrypted:
        oauth1AccessTokenSecretEncrypted ?? null,
      tokenExpiresAt: input.tokenExpiresAt,
      connectionStatus: ConnectionStatus.CONNECTED,
      lastError: null
    },
    select: xAccountSafeSelect
  });
}

export async function updateXTokens(
  accountReference: string,
  input: {
    accessToken?: string;
    refreshToken?: string | null;
    oauth1AccessToken?: string | null;
    oauth1AccessTokenSecret?: string | null;
    tokenExpiresAt?: Date | null;
  }
): Promise<SafeXAccount> {
  const accountId = await resolveXAccountInternalId(accountReference);

  if (!accountId) {
    throw new Error("X account not found");
  }

  return prisma.xAccount.update({
    where: { id: accountId },
    data: {
      accessTokenEncrypted:
        input.accessToken === undefined
          ? undefined
          : encryptSecret(normalizeSecret(input.accessToken, "X access token")),
      refreshTokenEncrypted:
        input.refreshToken === undefined
          ? undefined
          : input.refreshToken
            ? encryptSecret(
                normalizeSecret(input.refreshToken, "X refresh token")
              )
            : null,
      oauth1AccessTokenEncrypted:
        input.oauth1AccessToken === undefined
          ? undefined
          : input.oauth1AccessToken
            ? encryptSecret(
                normalizeSecret(
                  input.oauth1AccessToken,
                  "X OAuth1 access token"
                )
              )
            : null,
      oauth1AccessTokenSecretEncrypted:
        input.oauth1AccessTokenSecret === undefined
          ? undefined
          : input.oauth1AccessTokenSecret
            ? encryptSecret(
                normalizeSecret(
                  input.oauth1AccessTokenSecret,
                  "X OAuth1 access token secret"
                )
              )
            : null,
      tokenExpiresAt: input.tokenExpiresAt,
      connectionStatus: ConnectionStatus.CONNECTED,
      lastError: null
    },
    select: xAccountSafeSelect
  });
}

/**
 * OAuth1 medya token'larini cozer. Bunlar yalnizca gorsel/medya yuklemesinin
 * OAuth1 fallback'i icin gerekli OPSIYONEL kimlik bilgileridir; panele bir kez
 * elle girilip sonraki OAuth2 yeniden baglanmalarinda korunduklari icin bir
 * ENCRYPTION_KEY degisiminden sonra eski anahtarla kalabilirler. Bu durumda
 * cozme hatasi tum yayini opak "CREDENTIALS_DECRYPT_FAILED" ile dusurmemeli;
 * OAuth1'i kullanilamaz (null) sayip metin/OAuth2-medya akislarinin calismasina
 * izin veriyoruz. Gercek hata, gerektiginde medya yukleme adiminda actionable
 * olarak yuzeye cikar.
 */
function decryptXOAuth1(account: {
  oauth1AccessTokenEncrypted: string | null;
  oauth1AccessTokenSecretEncrypted: string | null;
}) {
  if (
    !account.oauth1AccessTokenEncrypted ||
    !account.oauth1AccessTokenSecretEncrypted
  ) {
    return null;
  }

  try {
    return {
      accessToken: decryptSecret(account.oauth1AccessTokenEncrypted),
      accessTokenSecret: decryptSecret(
        account.oauth1AccessTokenSecretEncrypted
      )
    };
  } catch (error) {
    console.warn(
      "X OAuth1 media credentials could not be decrypted; treating media upload credentials as unavailable.",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function getXTokens(
  accountReference: string,
  options: { allowSingleAccountFallback?: boolean } = {}
) {
  const account = await findXAccountByReference(accountReference, options);

  if (!account) {
    return null;
  }

  return {
    accountId: account.id,
    accessToken: decryptSecret(account.accessTokenEncrypted),
    refreshToken: account.refreshTokenEncrypted
      ? decryptSecret(account.refreshTokenEncrypted)
      : null,
    oauth1: decryptXOAuth1(account),
    tokenExpiresAt: account.tokenExpiresAt,
    xUserId: account.xUserId
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
  accountReference: string,
  connectionStatus: ConnectionStatus,
  lastError: string | null = null
): Promise<SafeXAccount> {
  const accountId = await resolveXAccountInternalId(accountReference);

  if (!accountId) {
    throw new Error("X account not found");
  }

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
