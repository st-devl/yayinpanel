"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { STANDARD_AI_FIELDS } from "@/lib/ai/field-mapper";

type Platform = "INSTAGRAM" | "X" | "WORDPRESS" | "CUSTOM_SITE";

type ConnectionStatus =
  | "CONNECTED"
  | "NEEDS_RECONNECT"
  | "TOKEN_EXPIRED"
  | "PERMISSION_MISSING"
  | "RATE_LIMITED"
  | "FAILED"
  | "DISCONNECTED";

type InstagramAccount = {
  id: string;
  accountName: string;
  username: string;
  instagramBusinessAccountId: string;
  facebookPageId: string;
  profileImageUrl: string | null;
  tokenExpiresAt: string | null;
  connectionStatus: ConnectionStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type XAccount = {
  id: string;
  accountName: string;
  username: string;
  xUserId: string;
  profileImageUrl: string | null;
  tokenExpiresAt: string | null;
  connectionStatus: ConnectionStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type WordPressSite = {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  connectionStatus: ConnectionStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type CustomSite = {
  id: string;
  name: string;
  baseUrl: string;
  connectionStatus: ConnectionStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccountCard =
  | (InstagramAccount & { platform: "INSTAGRAM" })
  | (XAccount & { platform: "X" })
  | (WordPressSite & { platform: "WORDPRESS" })
  | (CustomSite & { platform: "CUSTOM_SITE" });

type CreateForm = {
  platform: Platform;
  accountName: string;
  username: string;
  instagramBusinessAccountId: string;
  facebookPageId: string;
  accessToken: string;
  refreshToken: string;
  xUserId: string;
  tokenExpiresAt: string;
  name: string;
  baseUrl: string;
  applicationPassword: string;
  apiKey: string;
};

type ReconnectForm = {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  applicationPassword: string;
  apiKey: string;
};

type RequestState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const emptyCreateForm: CreateForm = {
  accessToken: "",
  accountName: "",
  apiKey: "",
  applicationPassword: "",
  baseUrl: "",
  facebookPageId: "",
  instagramBusinessAccountId: "",
  name: "",
  platform: "INSTAGRAM",
  refreshToken: "",
  tokenExpiresAt: "",
  username: "",
  xUserId: ""
};

const emptyReconnectForm: ReconnectForm = {
  accessToken: "",
  apiKey: "",
  applicationPassword: "",
  refreshToken: "",
  tokenExpiresAt: ""
};

const platformMeta: Record<
  Platform,
  { icon: string; iconClass: string; label: string; endpoint: string }
> = {
  INSTAGRAM: {
    endpoint: "/api/accounts/instagram",
    icon: "photo_camera",
    iconClass: "bg-[#E1306C]/10 text-[#E1306C]",
    label: "Instagram"
  },
  WORDPRESS: {
    endpoint: "/api/accounts/wordpress",
    icon: "web",
    iconClass: "bg-blue-50 text-blue-600",
    label: "WordPress"
  },
  X: {
    endpoint: "/api/accounts/x",
    icon: "share",
    iconClass: "bg-black/10 text-black",
    label: "X"
  },
  CUSTOM_SITE: {
    endpoint: "/api/accounts/custom-sites",
    icon: "code",
    iconClass: "bg-violet-50 text-violet-600",
    label: "Özel Site"
  }
};

const statusLabels: Record<ConnectionStatus, string> = {
  CONNECTED: "Bağlı",
  DISCONNECTED: "Bağlantı Yok",
  FAILED: "Hata",
  NEEDS_RECONNECT: "Yeniden Bağlantı",
  PERMISSION_MISSING: "Yetki Eksik",
  RATE_LIMITED: "Limit Aşıldı",
  TOKEN_EXPIRED: "Token Süresi Doldu"
};

function statusTone(status: ConnectionStatus) {
  if (status === "CONNECTED") return "success" as const;
  if (status === "DISCONNECTED") return "neutral" as const;
  if (status === "FAILED" || status === "TOKEN_EXPIRED")
    return "error" as const;
  return "warning" as const;
}

function alertClasses(tone: "success" | "error" | "info") {
  if (tone === "success") return "border-green-200 bg-green-50 text-green-800";
  if (tone === "error") {
    return "border-error/20 bg-error-container text-on-error-container";
  }
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(new Date(value));
}

function tokenStatus(value: string | null) {
  if (!value) return "Süre yok";

  const days = Math.ceil(
    (new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (days < 0) return "Süresi doldu";
  if (days === 0) return "Bugün doluyor";
  return `${days} gün kaldı`;
}

function accountTitle(account: AccountCard) {
  if (account.platform === "WORDPRESS" || account.platform === "CUSTOM_SITE") {
    return account.name;
  }
  return account.accountName;
}

function accountSubtitle(account: AccountCard) {
  if (account.platform === "WORDPRESS") {
    return `${account.baseUrl} · ${(account as WordPressSite).username}`;
  }
  if (account.platform === "CUSTOM_SITE") {
    return account.baseUrl;
  }
  return `@${account.username}`;
}

function accountIdentifier(account: AccountCard) {
  if (account.platform === "INSTAGRAM") {
    return account.instagramBusinessAccountId;
  }
  if (account.platform === "X") {
    return account.xUserId;
  }
  return account.baseUrl;
}

async function parsePayload<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<RequestState>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [reconnectTarget, setReconnectTarget] = useState<AccountCard | null>(
    null
  );
  const [reconnectForm, setReconnectForm] =
    useState<ReconnectForm>(emptyReconnectForm);

  // Field mapping modal state
  const [fieldMappingTarget, setFieldMappingTarget] = useState<string | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  const summaries = useMemo(() => {
    const connected = accounts.filter(
      (account) => account.connectionStatus === "CONNECTED"
    ).length;

    return {
      connected,
      needsAttention: accounts.length - connected,
      total: accounts.length
    };
  }, [accounts]);

  useEffect(() => {
    loadAccounts().catch((error) => {
      setRequestState({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Hesap bağlantıları alınamadı."
      });
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("xoauth");
    if (!result) return;

    const account = params.get("account");
    const messages: Record<string, RequestState> = {
      success: {
        tone: "success",
        message: account
          ? `X hesabı @${account} başarıyla bağlandı.`
          : "X hesabı başarıyla bağlandı."
      },
      denied: { tone: "error", message: "X yetkilendirmesi iptal edildi." },
      config_error: {
        tone: "error",
        message:
          "X OAuth yapılandırılmamış. X_CLIENT_ID ve X_CLIENT_SECRET tanımlayın."
      },
      state_mismatch: {
        tone: "error",
        message: "Güvenlik doğrulaması başarısız (state). Tekrar deneyin."
      },
      invalid: {
        tone: "error",
        message: "X yetkilendirme yanıtı geçersiz. Tekrar deneyin."
      },
      verify_failed: {
        tone: "error",
        message: "X kullanıcı bilgisi doğrulanamadı. İzinleri kontrol edin."
      },
      exchange_failed: {
        tone: "error",
        message:
          "X token değişimi başarısız. Callback URL ve istemci ayarlarını kontrol edin."
      }
    };

    // OAuth donusu yalnizca mount'ta URL'den okunur; banner gostermek icin
    // tek seferlik state guncellemesi beklenen davranis.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRequestState(
      messages[result] ?? {
        tone: "error",
        message: "X bağlantısı tamamlanamadı."
      }
    );

    if (result === "success") {
      loadAccounts().catch(() => undefined);
    }

    window.history.replaceState(null, "", "/accounts");
  }, []);

  async function loadAccounts() {
    setLoading(true);

    const [instagramResponse, xResponse, wordpressResponse, customSiteResponse] =
      await Promise.all([
        fetch("/api/accounts/instagram"),
        fetch("/api/accounts/x"),
        fetch("/api/accounts/wordpress"),
        fetch("/api/accounts/custom-sites")
      ]);

    const [instagramPayload, xPayload, wordpressPayload, customSitePayload] =
      await Promise.all([
        parsePayload<{ data?: InstagramAccount[] }>(instagramResponse),
        parsePayload<{ data?: XAccount[] }>(xResponse),
        parsePayload<{ data?: WordPressSite[] }>(wordpressResponse),
        parsePayload<{ data?: CustomSite[] }>(customSiteResponse)
      ]);

    if (!instagramResponse.ok) {
      throw new Error(
        instagramPayload.error ?? "Instagram hesapları alınamadı."
      );
    }
    if (!xResponse.ok) {
      throw new Error(xPayload.error ?? "X hesapları alınamadı.");
    }
    if (!wordpressResponse.ok) {
      throw new Error(
        wordpressPayload.error ?? "WordPress siteleri alınamadı."
      );
    }
    if (!customSiteResponse.ok) {
      throw new Error(customSitePayload.error ?? "Özel siteler alınamadı.");
    }

    setAccounts([
      ...((instagramPayload.data ?? []).map((account) => ({
        ...account,
        platform: "INSTAGRAM" as const
      })) satisfies AccountCard[]),
      ...((xPayload.data ?? []).map((account) => ({
        ...account,
        platform: "X" as const
      })) satisfies AccountCard[]),
      ...((wordpressPayload.data ?? []).map((site) => ({
        ...site,
        platform: "WORDPRESS" as const
      })) satisfies AccountCard[]),
      ...((customSitePayload.data ?? []).map((site) => ({
        ...site,
        platform: "CUSTOM_SITE" as const
      })) satisfies AccountCard[])
    ]);
    setLoading(false);
  }

  function updateCreateField(key: keyof CreateForm, value: string) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  function updateReconnectField(key: keyof ReconnectForm, value: string) {
    setReconnectForm((current) => ({ ...current, [key]: value }));
  }

  function createPayload() {
    if (createForm.platform === "INSTAGRAM") {
      return {
        accountName: createForm.accountName.trim(),
        accessToken: createForm.accessToken.trim(),
        facebookPageId: createForm.facebookPageId.trim(),
        instagramBusinessAccountId:
          createForm.instagramBusinessAccountId.trim(),
        tokenExpiresAt: createForm.tokenExpiresAt || undefined,
        username: createForm.username.trim()
      };
    }

    if (createForm.platform === "X") {
      return {
        accountName: createForm.accountName.trim(),
        accessToken: createForm.accessToken.trim(),
        refreshToken: createForm.refreshToken.trim() || undefined,
        tokenExpiresAt: createForm.tokenExpiresAt || undefined,
        username: createForm.username.trim(),
        xUserId: createForm.xUserId.trim()
      };
    }

    if (createForm.platform === "CUSTOM_SITE") {
      return {
        apiKey: createForm.apiKey.trim(),
        baseUrl: createForm.baseUrl.trim(),
        name: createForm.name.trim()
      };
    }

    return {
      applicationPassword: createForm.applicationPassword.trim(),
      baseUrl: createForm.baseUrl.trim(),
      name: createForm.name.trim(),
      username: createForm.username.trim()
    };
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setRequestState(null);

    try {
      const endpoint = platformMeta[createForm.platform].endpoint;
      const response = await fetch(endpoint, {
        body: JSON.stringify(createPayload()),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = await parsePayload<{ data?: unknown }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Hesap kaydedilemedi.");
      }

      setRequestState({
        tone: "success",
        message: "Hesap bağlantısı eklendi."
      });
      setCreateForm({ ...emptyCreateForm, platform: createForm.platform });
      await loadAccounts();
    } catch (error) {
      setRequestState({
        tone: "error",
        message: error instanceof Error ? error.message : "Hesap kaydedilemedi."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function runAccountAction(
    account: AccountCard,
    action: "test" | "refresh" | "delete"
  ) {
    const meta = platformMeta[account.platform];

    if (
      action === "delete" &&
      !window.confirm(`${accountTitle(account)} silinsin mi?`)
    ) {
      return;
    }

    setActionId(`${action}:${account.platform}:${account.id}`);
    setRequestState(null);

    try {
      const base = `${meta.endpoint}/${account.id}`;
      const response =
        action === "test"
          ? await fetch(`${base}/test`, { method: "POST" })
          : action === "refresh"
            ? await fetch(`${base}/reconnect`, { method: "POST" })
            : await fetch(base, { method: "DELETE" });
      const payload = await parsePayload<{
        ok?: boolean;
        connectionStatus?: ConnectionStatus;
        deleted?: boolean;
      }>(response);

      if (action === "delete") {
        if (!response.ok) {
          throw new Error(payload.error ?? "Hesap silinemedi.");
        }
        setRequestState({ tone: "success", message: "Hesap kaldırıldı." });
        await loadAccounts();
        return;
      }

      await loadAccounts();
      setRequestState({
        tone: payload.ok ? "success" : "error",
        message: payload.ok
          ? "Bağlantı doğrulandı."
          : (payload.message ??
            payload.error ??
            `${statusLabels[payload.connectionStatus ?? "FAILED"]}: işlem başarısız.`)
      });
    } catch (error) {
      setRequestState({
        tone: "error",
        message: error instanceof Error ? error.message : "İşlem başarısız."
      });
    } finally {
      setActionId(null);
    }
  }

  async function saveReconnect() {
    if (!reconnectTarget) return;

    setActionId(`reconnect:${reconnectTarget.platform}:${reconnectTarget.id}`);
    setRequestState(null);

    try {
      const base = `${platformMeta[reconnectTarget.platform].endpoint}/${reconnectTarget.id}`;
      const body =
        reconnectTarget.platform === "CUSTOM_SITE"
          ? { apiKey: reconnectForm.apiKey.trim() }
          : reconnectTarget.platform === "WORDPRESS"
          ? { applicationPassword: reconnectForm.applicationPassword.trim() }
          : {
              accessToken: reconnectForm.accessToken.trim(),
              refreshToken:
                reconnectTarget.platform === "X"
                  ? reconnectForm.refreshToken.trim() || undefined
                  : undefined,
              tokenExpiresAt: reconnectForm.tokenExpiresAt || undefined
            };

      const response = await fetch(base, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      const payload = await parsePayload<{ data?: unknown }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Yeniden bağlantı kaydedilemedi.");
      }

      setReconnectTarget(null);
      setReconnectForm(emptyReconnectForm);
      setRequestState({
        tone: "success",
        message: "Yeniden bağlantı bilgileri kaydedildi."
      });
      await loadAccounts();
    } catch (error) {
      setRequestState({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Yeniden bağlantı kaydedilemedi."
      });
    } finally {
      setActionId(null);
    }
  }

  function openReconnect(account: AccountCard) {
    setReconnectTarget(account);
    setReconnectForm(emptyReconnectForm);
  }

  async function openFieldMapping(siteId: string) {
    const res = await fetch(`/api/accounts/custom-sites/${siteId}/field-mapping`);
    const payload = (await res.json()) as { data?: Record<string, string> };
    setFieldMapping(payload.data ?? {});
    setFieldMappingTarget(siteId);
  }

  async function saveFieldMapping() {
    if (!fieldMappingTarget) return;
    await fetch(`/api/accounts/custom-sites/${fieldMappingTarget}/field-mapping`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping: fieldMapping })
    });
    setFieldMappingTarget(null);
    setRequestState({ tone: "success", message: "Alan eşleştirmesi kaydedildi." });
  }

  return (
    <AppShell title="Hesap Bağlantıları">
      <div className="space-y-xl">
        <section className="flex flex-col justify-between gap-md md:flex-row md:items-end">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Hesap Bağlantıları
            </h1>
            <p className="mt-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
              Instagram, X ve WordPress bağlantılarını test edin, yenileyin ve
              güvenli credential katmanına kaydedin.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-sm rounded-xl border border-outline-variant bg-surface-container-low p-sm text-center">
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Toplam
              </p>
              <p className="font-headline-sm text-headline-sm">
                {summaries.total}
              </p>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Bağlı
              </p>
              <p className="font-headline-sm text-headline-sm">
                {summaries.connected}
              </p>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Uyarı
              </p>
              <p className="font-headline-sm text-headline-sm">
                {summaries.needsAttention}
              </p>
            </div>
          </div>
        </section>

        {requestState ? (
          <section
            className={`rounded-xl border p-md ${alertClasses(requestState.tone)}`}
          >
            <p className="font-body-sm text-body-sm">{requestState.message}</p>
          </section>
        ) : null}

        <section className="panel-card p-md">
          <div className="mb-md flex items-center gap-sm">
            <MaterialIcon name="add_link" className="text-primary" />
            <h2 className="font-headline-sm text-headline-sm">Yeni Bağlantı</h2>
          </div>

          <form className="space-y-md" onSubmit={createAccount}>
            <div className="grid grid-cols-1 gap-md md:grid-cols-3">
              <label className="space-y-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Platform
                </span>
                <select
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  value={createForm.platform}
                  onChange={(event) =>
                    updateCreateField("platform", event.target.value)
                  }
                >
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="X">X / Twitter</option>
                  <option value="WORDPRESS">WordPress</option>
                  <option value="CUSTOM_SITE">Özel Site (Next.js / Laravel / vs.)</option>
                </select>
              </label>

              {createForm.platform === "WORDPRESS" ||
              createForm.platform === "CUSTOM_SITE" ? (
                <>
                  <TextInput
                    label="Site Adı"
                    value={createForm.name}
                    onChange={(value) => updateCreateField("name", value)}
                  />
                  <TextInput
                    label="Base URL"
                    type="url"
                    value={createForm.baseUrl}
                    onChange={(value) => updateCreateField("baseUrl", value)}
                  />
                </>
              ) : (
                <>
                  <TextInput
                    label="Hesap Adı"
                    value={createForm.accountName}
                    onChange={(value) =>
                      updateCreateField("accountName", value)
                    }
                  />
                  <TextInput
                    label="Kullanıcı Adı"
                    value={createForm.username}
                    onChange={(value) => updateCreateField("username", value)}
                  />
                </>
              )}
            </div>

            {createForm.platform === "INSTAGRAM" ? (
              <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-4">
                <TextInput
                  label="Instagram Business ID"
                  value={createForm.instagramBusinessAccountId}
                  onChange={(value) =>
                    updateCreateField("instagramBusinessAccountId", value)
                  }
                />
                <TextInput
                  label="Facebook Page ID"
                  value={createForm.facebookPageId}
                  onChange={(value) =>
                    updateCreateField("facebookPageId", value)
                  }
                />
                <TextInput
                  label="Access Token"
                  type="password"
                  value={createForm.accessToken}
                  onChange={(value) => updateCreateField("accessToken", value)}
                />
                <TextInput
                  label="Token Bitiş Tarihi"
                  type="datetime-local"
                  value={createForm.tokenExpiresAt}
                  onChange={(value) =>
                    updateCreateField("tokenExpiresAt", value)
                  }
                />
              </div>
            ) : null}

            {createForm.platform === "X" ? (
              <div className="space-y-md">
                <div className="flex flex-col gap-sm rounded-lg border border-blue-200 bg-blue-50 p-md text-blue-900 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-label-md text-label-md">
                      Önerilen: X ile Bağlan
                    </p>
                    <p className="font-body-sm text-body-sm">
                      X&apos;te yetki verin; gönderi atmak için gereken
                      kullanıcı token&apos;ı otomatik alınır. (Tweet atmak
                      app-only token ile çalışmaz.)
                    </p>
                  </div>
                  <button
                    type="button"
                    className="primary-button shrink-0 px-md py-sm font-label-md text-label-md"
                    onClick={() => {
                      window.location.href = "/api/accounts/x/oauth/start";
                    }}
                  >
                    <MaterialIcon name="link" />
                    X ile Bağlan
                  </button>
                </div>

                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Veya OAuth2 kullanıcı token&apos;ınızı elle girin:
                </p>

                <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-4">
                  <TextInput
                    label="X User ID"
                    value={createForm.xUserId}
                    onChange={(value) => updateCreateField("xUserId", value)}
                  />
                <TextInput
                  label="OAuth2 Access Token"
                  type="password"
                  value={createForm.accessToken}
                  onChange={(value) => updateCreateField("accessToken", value)}
                />
                <TextInput
                  label="Refresh Token (opsiyonel)"
                  type="password"
                  value={createForm.refreshToken}
                  onChange={(value) => updateCreateField("refreshToken", value)}
                />
                <TextInput
                  label="Token Bitiş Tarihi (opsiyonel)"
                  type="datetime-local"
                  value={createForm.tokenExpiresAt}
                  onChange={(value) =>
                    updateCreateField("tokenExpiresAt", value)
                  }
                />
                </div>
              </div>
            ) : null}

            {createForm.platform === "WORDPRESS" ? (
              <div className="grid grid-cols-1 gap-md md:grid-cols-2">
                <TextInput
                  label="WordPress Kullanıcısı"
                  value={createForm.username}
                  onChange={(value) => updateCreateField("username", value)}
                />
                <TextInput
                  label="Application Password"
                  type="password"
                  value={createForm.applicationPassword}
                  onChange={(value) =>
                    updateCreateField("applicationPassword", value)
                  }
                />
              </div>
            ) : null}

            {createForm.platform === "CUSTOM_SITE" ? (
              <div className="grid grid-cols-1 gap-md md:grid-cols-2">
                <TextInput
                  label="API Anahtarı (Bearer Token)"
                  type="password"
                  value={createForm.apiKey}
                  onChange={(value) => updateCreateField("apiKey", value)}
                />
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-sm text-violet-800">
                  <p className="font-body-sm text-body-sm">
                    Sitenizde{" "}
                    <code className="rounded bg-violet-100 px-1 font-mono text-xs">
                      POST /api/patlat/publish
                    </code>{" "}
                    ve{" "}
                    <code className="rounded bg-violet-100 px-1 font-mono text-xs">
                      GET /api/patlat/ping
                    </code>{" "}
                    endpoint&apos;lerini oluşturun.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                className="primary-button px-md py-sm font-label-md text-label-md disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                <MaterialIcon
                  name={submitting ? "progress_activity" : "save"}
                />
                {submitting ? "Kaydediliyor" : "Bağlantıyı Kaydet"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <div className="mb-md flex items-center gap-sm">
            <MaterialIcon name="hub" className="text-primary" />
            <h2 className="font-headline-md text-headline-md">
              Bağlı Platformlar
            </h2>
          </div>

          {loading ? (
            <div className="panel-card p-xl text-center font-body-md text-body-md text-on-surface-variant">
              Hesap bağlantıları yükleniyor...
            </div>
          ) : null}

          {!loading && accounts.length === 0 ? (
            <div className="panel-card flex min-h-[260px] flex-col items-center justify-center gap-sm p-xl text-center">
              <MaterialIcon
                name="link_off"
                className="text-outline"
                size={44}
              />
              <p className="font-headline-sm text-headline-sm">
                Henüz hesap bağlantısı yok
              </p>
              <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">
                Yayın akışlarını kullanmak için en az bir Instagram, X veya
                WordPress bağlantısı ekleyin.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => {
              const meta = platformMeta[account.platform];
              const busyPrefix = `${account.platform}:${account.id}`;
              const isBusy = actionId?.endsWith(busyPrefix);

              return (
                <article
                  key={`${account.platform}-${account.id}`}
                  className="panel-card flex min-h-[360px] flex-col justify-between p-md transition-shadow hover:shadow-panel-sm"
                >
                  <div>
                    <div className="mb-sm flex flex-wrap items-start justify-between gap-sm">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}
                      >
                        <MaterialIcon name={meta.icon} size={30} />
                      </div>
                      <StatusBadge tone={statusTone(account.connectionStatus)}>
                        {statusLabels[account.connectionStatus]}
                      </StatusBadge>
                    </div>

                    <h3 className="mb-xs truncate font-headline-sm text-headline-sm">
                      {accountTitle(account)}
                    </h3>
                    <p className="mb-md break-all font-body-sm text-body-sm text-on-surface-variant">
                      {meta.label} · {accountSubtitle(account)}
                    </p>

                    <dl className="space-y-xs font-body-sm text-body-sm">
                      <div className="flex justify-between gap-sm">
                        <dt className="text-on-surface-variant">Kimlik</dt>
                        <dd className="max-w-[60%] truncate font-medium">
                          {accountIdentifier(account)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-sm">
                        <dt className="text-on-surface-variant">
                          Son Güncelleme
                        </dt>
                        <dd className="font-medium">
                          {formatDateTime(account.updatedAt)}
                        </dd>
                      </div>
                      {account.platform !== "WORDPRESS" &&
                      account.platform !== "CUSTOM_SITE" ? (
                        <div className="flex justify-between gap-sm">
                          <dt className="text-on-surface-variant">Token</dt>
                          <dd className="font-medium">
                            {tokenStatus(account.tokenExpiresAt)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {account.lastError ? (
                      <div className="mt-md rounded-lg border border-error/10 bg-error-container/20 p-sm">
                        <p className="flex items-start gap-xs text-xs font-semibold text-error">
                          <MaterialIcon
                            name="warning"
                            className="shrink-0"
                            size={16}
                          />
                          <span className="min-w-0 break-words">
                            {account.lastError}
                          </span>
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-md flex flex-col gap-xs border-t border-outline-variant pt-md">
                    <button
                      className="primary-button w-full py-2 font-label-md text-label-md disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isBusy}
                      type="button"
                      onClick={() => runAccountAction(account, "test")}
                    >
                      <MaterialIcon name="verified" size={18} />
                      Bağlantıyı Test Et
                    </button>
                    <div className="flex flex-wrap gap-xs">
                      {account.platform === "CUSTOM_SITE" ? (
                        <button
                          className="secondary-button flex-1 py-2 font-label-sm text-label-sm"
                          type="button"
                          onClick={() => openFieldMapping(account.id)}
                        >
                          Alan Eşleştir
                        </button>
                      ) : null}
                      {account.platform === "X" ? (
                        <button
                          className="secondary-button flex-1 py-2 font-label-sm text-label-sm disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isBusy}
                          type="button"
                          onClick={() => runAccountAction(account, "refresh")}
                        >
                          Refresh Token
                        </button>
                      ) : null}
                      <button
                        className="secondary-button flex-1 py-2 font-label-sm text-label-sm"
                        type="button"
                        onClick={() => openReconnect(account)}
                      >
                        Yenile
                      </button>
                      <button
                        className="secondary-button flex-1 py-2 font-label-sm text-label-sm text-error hover:bg-error-container/20 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy}
                        type="button"
                        onClick={() => runAccountAction(account, "delete")}
                      >
                        Kaldır
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {reconnectTarget ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-md">
            <section className="panel-card w-full max-w-lg space-y-md p-md shadow-panel">
              <div className="flex items-start justify-between gap-md">
                <div>
                  <h2 className="font-headline-sm text-headline-sm">
                    {accountTitle(reconnectTarget)} Yenile
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Yeni credential değeri şifrelenerek saklanır.
                  </p>
                </div>
                <StatusBadge
                  tone={statusTone(reconnectTarget.connectionStatus)}
                >
                  {statusLabels[reconnectTarget.connectionStatus]}
                </StatusBadge>
              </div>

              {reconnectTarget.platform === "CUSTOM_SITE" ? (
                <TextInput
                  label="Yeni API Anahtarı"
                  type="password"
                  value={reconnectForm.apiKey}
                  onChange={(value) => updateReconnectField("apiKey", value)}
                />
              ) : reconnectTarget.platform === "WORDPRESS" ? (
                <TextInput
                  label="Yeni Application Password"
                  type="password"
                  value={reconnectForm.applicationPassword}
                  onChange={(value) =>
                    updateReconnectField("applicationPassword", value)
                  }
                />
              ) : (
                <div className="space-y-md">
                  <TextInput
                    label="Yeni Access Token"
                    type="password"
                    value={reconnectForm.accessToken}
                    onChange={(value) =>
                      updateReconnectField("accessToken", value)
                    }
                  />
                  {reconnectTarget.platform === "X" ? (
                    <TextInput
                      label="Yeni Refresh Token (opsiyonel)"
                      type="password"
                      value={reconnectForm.refreshToken}
                      onChange={(value) =>
                        updateReconnectField("refreshToken", value)
                      }
                    />
                  ) : null}
                  <TextInput
                    label="Token Bitiş Tarihi (opsiyonel)"
                    type="datetime-local"
                    value={reconnectForm.tokenExpiresAt}
                    onChange={(value) =>
                      updateReconnectField("tokenExpiresAt", value)
                    }
                  />
                </div>
              )}

              <div className="flex justify-end gap-sm">
                <button
                  className="secondary-button px-md py-sm font-label-md text-label-md"
                  type="button"
                  onClick={() => setReconnectTarget(null)}
                >
                  Vazgeç
                </button>
                <button
                  className="primary-button px-md py-sm font-label-md text-label-md"
                  type="button"
                  onClick={saveReconnect}
                >
                  Kaydet
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {/* Field Mapping Modal */}
        {fieldMappingTarget ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-md">
            <section className="panel-card w-full max-w-lg space-y-md overflow-y-auto p-md shadow-panel max-h-[90vh]">
              <div className="flex items-center justify-between gap-md">
                <div>
                  <h2 className="font-headline-sm text-headline-sm">Alan Eşleştirme</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    AI&apos;ın standart alanlarını sitenizin API alan adlarıyla eşleştirin.
                  </p>
                </div>
                <button type="button" className="text-outline" onClick={() => setFieldMappingTarget(null)}>
                  <MaterialIcon name="close" />
                </button>
              </div>
              <div className="space-y-sm">
                {STANDARD_AI_FIELDS.map((field) => (
                  <div key={field} className="grid grid-cols-2 items-center gap-sm">
                    <span className="font-label-sm text-label-sm">
                      {field}
                    </span>
                    <input
                      type="text"
                      className="input-surface rounded-lg px-3 py-2 font-body-sm text-body-sm"
                      placeholder={field}
                      value={fieldMapping[field] ?? ""}
                      onChange={(e) =>
                        setFieldMapping((prev) => ({
                          ...prev,
                          [field]: e.target.value
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="font-body-sm text-body-sm text-outline">
                Boş bırakılan alanlar için AI varsayılan alan adını kullanır.
              </p>
              <div className="flex justify-end gap-sm">
                <button
                  type="button"
                  className="secondary-button px-md py-sm font-label-md text-label-md"
                  onClick={() => setFieldMappingTarget(null)}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="primary-button px-md py-sm font-label-md text-label-md"
                  onClick={saveFieldMapping}
                >
                  Kaydet
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function TextInput({
  label,
  onChange,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="space-y-xs">
      <span className="font-label-sm text-label-sm text-on-surface-variant">
        {label}
      </span>
      <input
        className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
