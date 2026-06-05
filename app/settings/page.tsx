"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";

type SettingKey =
  | "TIMEZONE"
  | "IG_DAILY_POST_LIMIT"
  | "BACKUP_PATH"
  | "TELEGRAM_ENABLED";

type AIProviderType = "OPENAI" | "ANTHROPIC" | "GOOGLE" | "XAI" | "GROQ" | "CUSTOM";

type AIProvider = {
  id: string;
  name: string;
  providerType: AIProviderType;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
};

type UsageSummary = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  requestCount: number;
};

const AI_PROVIDER_LABELS: Record<AIProviderType, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic Claude",
  GOOGLE: "Google Gemini",
  XAI: "xAI Grok",
  GROQ: "Groq",
  CUSTOM: "Özel (Custom)"
};

const AI_PROVIDER_MODELS: Record<AIProviderType, string[]> = {
  OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  ANTHROPIC: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
  GOOGLE: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
  XAI: ["grok-beta", "grok-vision-beta"],
  GROQ: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
  CUSTOM: []
};

type SettingsMap = Record<SettingKey, string>;

type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

type HealthItem = {
  title: string;
  value: string;
  description: string;
  icon: string;
  tone: StatusTone;
};

type BackupFile = {
  fileName: string;
  absolutePath: string;
  size: number;
  createdAt: string;
};

type SystemStatus = {
  checkedAt: string;
  settings: SettingsMap;
  counters: {
    contentCardCount: number;
    scheduledCardCount: number;
    mediaFileCount: number;
    publishLogCount: number;
  };
  health: HealthItem[];
  backup: {
    retentionDays: number;
    path: {
      configuredPath: string;
      absolutePath: string;
      exists: boolean;
      isDirectory: boolean;
      writable: boolean;
    };
    database: {
      command: string;
      file: {
        configuredPath: string;
        absolutePath: string;
        exists: boolean;
        size: number | null;
        updatedAt: string | null;
      };
      latestFiles: BackupFile[];
    };
    media: {
      command: string;
      storage: {
        configuredPath: string;
        absolutePath: string;
        exists: boolean;
        isDirectory: boolean;
        writable: boolean;
      };
      latestFiles: BackupFile[];
    };
  };
};

type RequestState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const emptySettings: SettingsMap = {
  BACKUP_PATH: "./backups",
  IG_DAILY_POST_LIMIT: "10",
  TELEGRAM_ENABLED: "false",
  TIMEZONE: "Europe/Istanbul"
};

const settingFields: Array<{
  key: SettingKey;
  title: string;
  description: string;
  icon: string;
  type: "text" | "number" | "toggle";
}> = [
  {
    description:
      "Panel tarihleri yerel saatle gösterilir, veritabanı UTC tutar.",
    icon: "schedule",
    key: "TIMEZONE",
    title: "Zaman Dilimi",
    type: "text"
  },
  {
    description: "Instagram toplu planlama uyarısı için günlük eşik.",
    icon: "photo_camera",
    key: "IG_DAILY_POST_LIMIT",
    title: "Instagram Günlük Limit",
    type: "number"
  },
  {
    description: "Backup scriptlerinin hedef klasörü.",
    icon: "backup",
    key: "BACKUP_PATH",
    title: "Yedekleme Klasörü",
    type: "text"
  },
  {
    description: "Telegram env değerleri doluysa yayın uyarılarını açar.",
    icon: "send",
    key: "TELEGRAM_ENABLED",
    title: "Telegram Bildirimleri",
    type: "toggle"
  }
];

function formatFileSize(bytes: number | null) {
  if (bytes === null) {
    return "Bilinmiyor";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Henüz yok";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(new Date(value));
}

function alertClasses(tone: "success" | "error" | "info") {
  if (tone === "success") {
    return "border-green-200 bg-green-50 text-green-800";
  }

  if (tone === "error") {
    return "border-error/20 bg-error-container text-on-error-container";
  }

  return "border-blue-200 bg-blue-50 text-blue-800";
}

function latestBackupLabel(files: BackupFile[]) {
  return files[0] ? formatDateTime(files[0].createdAt) : "Henüz yok";
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>(emptySettings);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>(null);

  // AI Provider state
  const [aiProviders, setAIProviders] = useState<AIProvider[]>([]);
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const [aiForm, setAIForm] = useState({
    name: "",
    providerType: "OPENAI" as AIProviderType,
    apiKey: "",
    model: "gpt-4o",
    baseUrl: "",
    isDefault: false
  });
  const [aiTestResults, setAITestResults] = useState<Record<string, string>>({});
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);

  const counters = useMemo(
    () => [
      {
        icon: "inventory_2",
        label: "İçerik Kartı",
        value: systemStatus?.counters.contentCardCount ?? 0
      },
      {
        icon: "schedule",
        label: "Planlı Kart",
        value: systemStatus?.counters.scheduledCardCount ?? 0
      },
      {
        icon: "perm_media",
        label: "Medya",
        value: systemStatus?.counters.mediaFileCount ?? 0
      },
      {
        icon: "history",
        label: "Log",
        value: systemStatus?.counters.publishLogCount ?? 0
      }
    ],
    [systemStatus]
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);

      try {
        const [settingsResponse, statusResponse] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/system/status")
        ]);
        const settingsPayload = (await settingsResponse.json()) as {
          data?: SettingsMap;
          error?: string;
        };
        const statusPayload = (await statusResponse.json()) as {
          data?: SystemStatus;
          error?: string;
        };

        if (!settingsResponse.ok) {
          throw new Error(settingsPayload.error ?? "Ayarlar alınamadı.");
        }

        if (!statusResponse.ok) {
          throw new Error(statusPayload.error ?? "Sistem durumu alınamadı.");
        }

        if (active) {
          setSettings(settingsPayload.data ?? emptySettings);
          setSystemStatus(statusPayload.data ?? null);
        }
      } catch (error) {
        if (active) {
          setRequestState({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Ayarlar veya sistem durumu alınamadı."
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();
    void loadAIProviders();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateSetting(key: SettingKey, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function refreshSystemStatus() {
    const response = await fetch("/api/system/status");
    const payload = (await response.json()) as {
      data?: SystemStatus;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Sistem durumu yenilenemedi.");
    }

    setSystemStatus(payload.data ?? null);
  }

  async function loadAIProviders() {
    setAILoading(true);

    try {
      const [provRes, usageRes] = await Promise.all([
        fetch("/api/ai/providers"),
        fetch("/api/ai/usage/summary")
      ]);

      const provPayload = (await provRes.json()) as { data?: AIProvider[] };
      if (provRes.ok) setAIProviders(provPayload.data ?? []);

      if (usageRes.ok) {
        const usagePayload = (await usageRes.json()) as { data?: UsageSummary };
        setUsageSummary(usagePayload.data ?? null);
      }
    } finally {
      setAILoading(false);
    }
  }

  async function createAIProvider(e: FormEvent) {
    e.preventDefault();
    setAIError(null);

    try {
      const res = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: aiForm.name,
          providerType: aiForm.providerType,
          apiKey: aiForm.apiKey,
          model: aiForm.model,
          baseUrl: aiForm.baseUrl || undefined,
          isDefault: aiForm.isDefault
        })
      });

      const payload = (await res.json()) as { data?: AIProvider; error?: string };

      if (!res.ok) throw new Error(payload.error ?? "Sağlayıcı eklenemedi.");

      setAIForm({ name: "", providerType: "OPENAI", apiKey: "", model: "gpt-4o", baseUrl: "", isDefault: false });
      await loadAIProviders();
    } catch (err) {
      setAIError(err instanceof Error ? err.message : "Hata.");
    }
  }

  async function deleteAIProvider(id: string) {
    if (!window.confirm("Bu sağlayıcı silinsin mi?")) return;

    try {
      const res = await fetch(`/api/ai/providers/${id}`, { method: "DELETE" });
      const payload = (await res.json()) as { deleted?: boolean; error?: string };

      if (!res.ok) {
        throw new Error(payload.error ?? "Sağlayıcı silinemedi.");
      }

      await loadAIProviders();
    } catch (err) {
      setAIError(err instanceof Error ? err.message : "Sağlayıcı silinemedi.");
    }
  }

  async function setDefaultProvider(id: string) {
    await fetch(`/api/ai/providers/${id}/default`, { method: "POST" });
    await loadAIProviders();
  }

  async function testProvider(id: string) {
    setAITestResults((prev) => ({ ...prev, [id]: "test_running" }));

    try {
      const res = await fetch(`/api/ai/providers/${id}/test`, { method: "POST" });
      const payload = (await res.json()) as { ok?: boolean; error?: string; model?: string };
      setAITestResults((prev) => ({
        ...prev,
        [id]: payload.ok ? `Bağlantı başarılı · ${payload.model}` : (payload.error ?? "Bağlantı başarısız")
      }));
    } catch {
      setAITestResults((prev) => ({ ...prev, [id]: "Bağlantı hatası" }));
    }
  }

  async function saveSettings() {
    setSaving(true);
    setRequestState(null);

    try {
      const response = await fetch("/api/settings", {
        body: JSON.stringify(settings),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      const payload = (await response.json()) as {
        data?: SettingsMap;
        results?: Array<{ ok: boolean; error?: string; key: string }>;
        error?: string;
      };

      if (!response.ok) {
        const firstError = payload.results?.find((result) => !result.ok);
        throw new Error(
          firstError?.error
            ? `${firstError.key}: ${firstError.error}`
            : (payload.error ?? "Ayarlar kaydedilemedi.")
        );
      }

      setSettings(payload.data ?? settings);
      await refreshSystemStatus();
      setRequestState({ tone: "success", message: "Ayarlar kaydedildi." });
    } catch (error) {
      setRequestState({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Ayarlar kaydedilemedi."
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Ayarlar">
      <div className="space-y-lg">
        <section className="flex flex-col justify-between gap-md md:flex-row md:items-end">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Ayarlar
            </h1>
            <p className="mt-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
              Zamanlama, bildirim, limit, sistem durumu ve yedekleme ayarlarını
              tek kullanıcı kullanımına uygun şekilde yönetin.
            </p>
          </div>
          <button
            className="primary-button px-md py-sm font-label-md text-label-md disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || saving}
            type="button"
            onClick={saveSettings}
          >
            <MaterialIcon name={saving ? "progress_activity" : "save"} />
            {saving ? "Kaydediliyor" : "Ayarları Kaydet"}
          </button>
        </section>

        {requestState ? (
          <section
            className={`rounded-xl border p-md ${alertClasses(requestState.tone)}`}
          >
            <p className="font-body-sm text-body-sm">{requestState.message}</p>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-md lg:grid-cols-2">
          {settingFields.map((field) => (
            <article key={field.key} className="panel-card p-md">
              <div className="mb-md flex items-start gap-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-primary">
                  <MaterialIcon name={field.icon} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-headline-sm text-headline-sm">
                    {field.title}
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {field.description}
                  </p>
                </div>
              </div>

              {field.type === "toggle" ? (
                <label className="flex items-center justify-between gap-md rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm">
                  <span className="font-label-md text-label-md">
                    {settings[field.key] === "true" ? "Aktif" : "Pasif"}
                  </span>
                  <input
                    className="h-5 w-5 rounded border-outline text-primary focus:ring-primary"
                    checked={settings[field.key] === "true"}
                    type="checkbox"
                    onChange={(event) =>
                      updateSetting(field.key, String(event.target.checked))
                    }
                  />
                </label>
              ) : (
                <input
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-md text-body-md"
                  min={field.key === "IG_DAILY_POST_LIMIT" ? 1 : undefined}
                  max={field.key === "IG_DAILY_POST_LIMIT" ? 50 : undefined}
                  type={field.type}
                  value={settings[field.key]}
                  onChange={(event) =>
                    updateSetting(field.key, event.target.value)
                  }
                />
              )}
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-4">
          {counters.map((counter) => (
            <article key={counter.label} className="panel-card p-md">
              <div className="flex items-center justify-between gap-sm">
                <div>
                  <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                    {counter.label}
                  </p>
                  <p className="mt-xs font-headline-md text-headline-md text-primary">
                    {counter.value}
                  </p>
                </div>
                <MaterialIcon
                  name={counter.icon}
                  className="text-outline"
                  size={32}
                />
              </div>
            </article>
          ))}
        </section>

        <section>
          <div className="mb-md flex flex-wrap items-end justify-between gap-sm">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary">
                Sistem Durumu
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Son kontrol: {formatDateTime(systemStatus?.checkedAt ?? null)}
              </p>
            </div>
            <button
              className="secondary-button px-md py-sm font-label-md text-label-md"
              disabled={loading}
              type="button"
              onClick={refreshSystemStatus}
            >
              <MaterialIcon name="refresh" size={18} />
              Yenile
            </button>
          </div>

          <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
            {(systemStatus?.health ?? []).map((item) => (
              <article key={item.title} className="panel-card p-md">
                <div className="mb-sm flex items-start justify-between gap-md">
                  <div className="flex min-w-0 items-center gap-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-primary">
                      <MaterialIcon name={item.icon} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-label-md text-label-md">
                        {item.title}
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {item.value}
                      </p>
                    </div>
                  </div>
                  <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                </div>
                <p className="break-words font-body-sm text-body-sm text-on-surface-variant">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {systemStatus ? (
          <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
            <article className="panel-card p-md">
              <div className="mb-md flex items-start justify-between gap-md">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-primary">
                    SQLite Yedeği
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Son yedek:{" "}
                    {latestBackupLabel(
                      systemStatus.backup.database.latestFiles
                    )}
                  </p>
                </div>
                <StatusBadge
                  tone={
                    systemStatus.backup.database.file.exists
                      ? "success"
                      : "error"
                  }
                >
                  {systemStatus.backup.database.file.exists
                    ? formatFileSize(systemStatus.backup.database.file.size)
                    : "DB yok"}
                </StatusBadge>
              </div>

              <dl className="space-y-sm">
                <div>
                  <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                    Veritabanı Dosyası
                  </dt>
                  <dd className="break-all font-body-sm text-body-sm">
                    {systemStatus.backup.database.file.absolutePath}
                  </dd>
                </div>
                <div>
                  <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                    Komut
                  </dt>
                  <dd className="mt-xs rounded-lg bg-surface-container-low p-sm">
                    <code className="break-all font-mono text-[12px]">
                      {systemStatus.backup.database.command}
                    </code>
                  </dd>
                </div>
              </dl>

              <ul className="mt-md space-y-xs">
                {systemStatus.backup.database.latestFiles.length > 0 ? (
                  systemStatus.backup.database.latestFiles.map((file) => (
                    <li
                      key={file.absolutePath}
                      className="flex flex-wrap items-center justify-between gap-sm rounded-lg bg-surface-container-low px-sm py-xs"
                    >
                      <span className="break-all font-body-sm text-body-sm">
                        {file.fileName}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {formatFileSize(file.size)}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="font-body-sm text-body-sm text-on-surface-variant">
                    Bu klasörde henüz veritabanı yedeği yok.
                  </li>
                )}
              </ul>
            </article>

            <article className="panel-card p-md">
              <div className="mb-md flex items-start justify-between gap-md">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-primary">
                    Medya Yedeği
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Son yedek:{" "}
                    {latestBackupLabel(systemStatus.backup.media.latestFiles)}
                  </p>
                </div>
                <StatusBadge
                  tone={
                    systemStatus.backup.media.storage.exists
                      ? "success"
                      : "warning"
                  }
                >
                  {systemStatus.backup.media.storage.exists
                    ? "Storage hazır"
                    : "Eksik"}
                </StatusBadge>
              </div>

              <dl className="space-y-sm">
                <div>
                  <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                    Medya Klasörü
                  </dt>
                  <dd className="break-all font-body-sm text-body-sm">
                    {systemStatus.backup.media.storage.absolutePath}
                  </dd>
                </div>
                <div>
                  <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                    Komut
                  </dt>
                  <dd className="mt-xs rounded-lg bg-surface-container-low p-sm">
                    <code className="break-all font-mono text-[12px]">
                      {systemStatus.backup.media.command}
                    </code>
                  </dd>
                </div>
              </dl>

              <ul className="mt-md space-y-xs">
                {systemStatus.backup.media.latestFiles.length > 0 ? (
                  systemStatus.backup.media.latestFiles.map((file) => (
                    <li
                      key={file.absolutePath}
                      className="flex flex-wrap items-center justify-between gap-sm rounded-lg bg-surface-container-low px-sm py-xs"
                    >
                      <span className="break-all font-body-sm text-body-sm">
                        {file.fileName}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {formatFileSize(file.size)}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="font-body-sm text-body-sm text-on-surface-variant">
                    Bu klasörde henüz medya yedeği yok.
                  </li>
                )}
              </ul>
            </article>
          </section>
        ) : null}

        {systemStatus ? (
          <section className="rounded-xl border border-error bg-error-container p-md text-on-error-container">
            <div className="flex items-start gap-sm">
              <MaterialIcon name="key" className="text-error" />
              <div>
                <h2 className="font-label-md text-label-md font-bold">
                  ENCRYPTION_KEY Kritik
                </h2>
                <p className="mt-xs font-body-sm text-body-sm">
                  Bu anahtar kaybedilirse şifreli sosyal medya tokenları ve
                  WordPress application password kayıtları çözülemez. Veritabanı
                  yedeğinden ayrı, güvenli bir yerde saklanmalıdır.
                </p>
                <p className="mt-sm font-body-sm text-body-sm">
                  Backup klasörü: {systemStatus.backup.path.absolutePath}. Eski
                  yedekler {systemStatus.backup.retentionDays} gün sonra
                  scriptler tarafından temizlenir.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* ───── Yapay Zekâ Sağlayıcıları ───── */}
        <section className="panel-card p-md">
          <div className="mb-md flex items-center gap-sm">
            <MaterialIcon name="auto_awesome" className="text-primary" />
            <h2 className="font-headline-sm text-headline-sm">
              Yapay Zekâ Sağlayıcıları
            </h2>
          </div>

          {aiError && (
            <div className="mb-md rounded-xl border border-error/20 bg-error-container p-sm text-on-error-container">
              <p className="font-body-sm text-body-sm">{aiError}</p>
            </div>
          )}

          {/* Mevcut sağlayıcılar */}
          {aiProviders.length > 0 && (
            <div className="mb-md space-y-sm">
              {aiProviders.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-sm rounded-xl border border-outline-variant bg-surface-container-low p-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-xs">
                      <span className="font-label-md text-label-md">{p.name}</span>
                      {p.isDefault && (
                        <StatusBadge tone="success">Varsayılan</StatusBadge>
                      )}
                      {!p.isActive && (
                        <StatusBadge tone="neutral">Pasif</StatusBadge>
                      )}
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {AI_PROVIDER_LABELS[p.providerType]} · {p.model}
                    </p>
                    {aiTestResults[p.id] && (
                      <p
                        className={`mt-xs font-body-sm text-body-sm ${
                          aiTestResults[p.id].startsWith("Bağlantı başarılı")
                            ? "text-success"
                            : aiTestResults[p.id] === "test_running"
                              ? "text-outline"
                              : "text-error"
                        }`}
                      >
                        {aiTestResults[p.id] === "test_running"
                          ? "Test ediliyor..."
                          : aiTestResults[p.id]}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-xs">
                    <button
                      type="button"
                      className="secondary-button px-sm py-xs font-label-sm text-label-sm"
                      onClick={() => testProvider(p.id)}
                    >
                      Test
                    </button>
                    {!p.isDefault && (
                      <button
                        type="button"
                        className="secondary-button px-sm py-xs font-label-sm text-label-sm"
                        onClick={() => setDefaultProvider(p.id)}
                      >
                        Varsayılan Yap
                      </button>
                    )}
                    <button
                      type="button"
                      className="secondary-button px-sm py-xs font-label-sm text-label-sm text-error hover:bg-error-container/20"
                      onClick={() => deleteAIProvider(p.id)}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Yeni sağlayıcı formu */}
          <form className="space-y-md" onSubmit={createAIProvider}>
            <h3 className="font-label-lg text-label-lg text-on-surface-variant">
              Yeni Sağlayıcı Ekle
            </h3>
            <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Sağlayıcı Adı
                </span>
                <input
                  type="text"
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  placeholder="Örn: ChatGPT Pro"
                  value={aiForm.name}
                  onChange={(e) => setAIForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </label>
              <label className="space-y-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Sağlayıcı
                </span>
                <select
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  value={aiForm.providerType}
                  onChange={(e) => {
                    const pt = e.target.value as AIProviderType;
                    const models = AI_PROVIDER_MODELS[pt];
                    setAIForm((f) => ({
                      ...f,
                      providerType: pt,
                      model: models[0] ?? ""
                    }));
                  }}
                >
                  {Object.entries(AI_PROVIDER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Model
                </span>
                {AI_PROVIDER_MODELS[aiForm.providerType].length > 0 ? (
                  <select
                    className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                    value={aiForm.model}
                    onChange={(e) => setAIForm((f) => ({ ...f, model: e.target.value }))}
                  >
                    {AI_PROVIDER_MODELS[aiForm.providerType].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                    placeholder="model-adı"
                    value={aiForm.model}
                    onChange={(e) => setAIForm((f) => ({ ...f, model: e.target.value }))}
                    required
                  />
                )}
              </label>
              <label className="space-y-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  API Anahtarı
                </span>
                <input
                  type="password"
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  placeholder="sk-..."
                  value={aiForm.apiKey}
                  onChange={(e) => setAIForm((f) => ({ ...f, apiKey: e.target.value }))}
                  required
                />
              </label>
            </div>
            {aiForm.providerType === "CUSTOM" && (
              <label className="block space-y-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  API Adresi (Base URL)
                </span>
                <input
                  type="url"
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  placeholder="https://api.example.com"
                  value={aiForm.baseUrl}
                  onChange={(e) => setAIForm((f) => ({ ...f, baseUrl: e.target.value }))}
                />
              </label>
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-xs font-body-sm text-body-sm">
                <input
                  type="checkbox"
                  checked={aiForm.isDefault}
                  onChange={(e) => setAIForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                Varsayılan sağlayıcı olarak ayarla
              </label>
              <button
                type="submit"
                className="primary-button px-md py-sm font-label-md text-label-md"
                disabled={aiLoading}
              >
                <MaterialIcon name="save" size={16} />
                Sağlayıcı Ekle
              </button>
            </div>
          </form>
        </section>

        {/* ───── Yapay Zekâ Kullanımı ───── */}
        {usageSummary !== null && (
          <section className="panel-card p-md">
            <div className="mb-md flex items-center gap-sm">
              <MaterialIcon name="analytics" className="text-primary" />
              <h2 className="font-headline-sm text-headline-sm">
                Yapay Zekâ Kullanımı (Bu Ay)
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-sm md:grid-cols-4">
              {[
                { label: "Giriş Token", value: usageSummary.totalInputTokens.toLocaleString("tr") },
                { label: "Çıkış Token", value: usageSummary.totalOutputTokens.toLocaleString("tr") },
                { label: "Tahmini Maliyet", value: `$${usageSummary.totalCostUsd.toFixed(4)}` },
                { label: "İstek Sayısı", value: String(usageSummary.requestCount) }
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-outline-variant bg-surface-container-low p-sm text-center"
                >
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    {label}
                  </p>
                  <p className="font-headline-sm text-headline-sm">{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
