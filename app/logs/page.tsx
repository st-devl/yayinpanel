"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";

type Platform = "INSTAGRAM" | "X" | "WORDPRESS";
type PublishLogStatus = "OK" | "ERROR" | "WARNING";

type LogRow = {
  id: string;
  platform: Platform;
  accountId: string | null;
  accountLabel: string;
  contentCardId: string | null;
  contentCard: {
    id: string;
    status: string;
    text: string | null;
    externalPostUrl: string | null;
  } | null;
  action: string;
  status: PublishLogStatus;
  apiResponse: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type RequestState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const platformMeta: Record<Platform, { icon: string; label: string }> = {
  INSTAGRAM: { icon: "photo_camera", label: "Instagram" },
  WORDPRESS: { icon: "web", label: "WordPress" },
  X: { icon: "share", label: "X" }
};

const statusMeta: Record<
  PublishLogStatus,
  { label: string; tone: "success" | "warning" | "error" }
> = {
  ERROR: { label: "Hata", tone: "error" },
  OK: { label: "Başarılı", tone: "success" },
  WARNING: { label: "Uyarı", tone: "warning" }
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(new Date(value));
}

function alertClasses(tone: "success" | "error" | "info") {
  if (tone === "success") return "border-green-200 bg-green-50 text-green-800";
  if (tone === "error") {
    return "border-error/20 bg-error-container text-on-error-container";
  }
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function logMessage(log: LogRow) {
  if (log.errorMessage) return log.errorMessage;
  if (log.errorCode) return log.errorCode;
  if (log.apiResponse) return "API yanıtı kaydedildi.";
  return "Olay kaydı tamamlandı.";
}

function prettyJson(value: string | null) {
  if (!value) return "-";

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function csvEscape(value: string | null | undefined) {
  const normalized = value ?? "";
  return `"${normalized.replaceAll('"', '""')}"`;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestState, setRequestState] = useState<RequestState>(null);
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null);

  const summary = useMemo(
    () => ({
      errors: logs.filter((log) => log.status === "ERROR").length,
      ok: logs.filter((log) => log.status === "OK").length,
      warnings: logs.filter((log) => log.status === "WARNING").length
    }),
    [logs]
  );

  useEffect(() => {
    let active = true;

    async function loadLogs() {
      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (platform) params.set("platform", platform);
        if (status) params.set("status", status);
        if (action) params.set("action", action);
        if (from) params.set("from", from);
        if (to) params.set("to", to);

        const response = await fetch(`/api/logs?${params.toString()}`);
        if (!active) return;

        const payload = (await response.json()) as {
          actions?: string[];
          data?: LogRow[];
          error?: string;
        };
        if (!active) return;

        if (!response.ok) {
          throw new Error(payload.error ?? "Log kayıtları alınamadı.");
        }

        setLogs(payload.data ?? []);
        setActions(payload.actions ?? []);
      } catch (error) {
        if (!active) return;
        setRequestState({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Log kayıtları alınamadı."
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadLogs().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [action, from, platform, status, to]);

  function exportCsv() {
    const header = [
      "createdAt",
      "platform",
      "account",
      "action",
      "status",
      "errorCode",
      "message"
    ];
    const rows = logs.map((log) => [
      log.createdAt,
      log.platform,
      log.accountLabel,
      log.action,
      log.status,
      log.errorCode ?? "",
      logMessage(log)
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "patlat-yayin-loglari.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setPlatform("");
    setStatus("");
    setAction("");
    setFrom("");
    setTo("");
    setRequestState(null);
  }

  return (
    <AppShell title="Yayın Logları">
      <div className="space-y-lg">
        <section className="flex flex-col justify-between gap-md md:flex-row md:items-end">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Yayın Logları
            </h1>
            <p className="mt-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
              Scheduler ve publisher olaylarını, hata sınıflarını ve manuel
              kontrol uyarılarını gerçek log kayıtlarından izleyin.
            </p>
          </div>
          <button
            className="secondary-button w-full rounded-lg px-md py-sm font-label-md text-label-md disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={logs.length === 0}
            type="button"
            onClick={exportCsv}
          >
            <MaterialIcon name="download" />
            Dışa Aktar
          </button>
        </section>

        {requestState ? (
          <section
            className={`rounded-xl border p-md ${alertClasses(requestState.tone)}`}
          >
            <p className="font-body-sm text-body-sm">{requestState.message}</p>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-md md:grid-cols-3">
          <article className="panel-card p-md">
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Başarılı
            </p>
            <p className="mt-xs font-headline-md text-headline-md text-primary">
              {summary.ok}
            </p>
          </article>
          <article className="panel-card p-md">
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Uyarı
            </p>
            <p className="mt-xs font-headline-md text-headline-md text-primary">
              {summary.warnings}
            </p>
          </article>
          <article className="panel-card p-md">
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Hata
            </p>
            <p className="mt-xs font-headline-md text-headline-md text-primary">
              {summary.errors}
            </p>
          </article>
        </section>

        <section className="panel-card flex flex-wrap gap-md p-md">
          <label className="min-w-[160px] flex-1">
            <span className="mb-xs block font-label-sm text-label-sm text-on-surface-variant">
              Platform
            </span>
            <select
              className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
            >
              <option value="">Hepsi</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="X">X</option>
              <option value="WORDPRESS">WordPress</option>
            </select>
          </label>

          <label className="min-w-[160px] flex-1">
            <span className="mb-xs block font-label-sm text-label-sm text-on-surface-variant">
              Durum
            </span>
            <select
              className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Hepsi</option>
              {Object.entries(statusMeta).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[180px] flex-1">
            <span className="mb-xs block font-label-sm text-label-sm text-on-surface-variant">
              Aksiyon
            </span>
            <select
              className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="">Hepsi</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[150px] flex-1">
            <span className="mb-xs block font-label-sm text-label-sm text-on-surface-variant">
              Başlangıç
            </span>
            <input
              className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>

          <label className="min-w-[150px] flex-1">
            <span className="mb-xs block font-label-sm text-label-sm text-on-surface-variant">
              Bitiş
            </span>
            <input
              className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>

          <div className="flex items-end">
            <button
              className="secondary-button px-md py-2 font-label-md text-label-md"
              type="button"
              onClick={clearFilters}
            >
              <MaterialIcon name="filter_alt_off" size={18} />
              Temizle
            </button>
          </div>
        </section>

        {loading ? (
          <section className="panel-card p-xl text-center font-body-md text-body-md text-on-surface-variant">
            Log kayıtları yükleniyor...
          </section>
        ) : null}

        {!loading && logs.length === 0 ? (
          <section className="panel-card flex min-h-[260px] flex-col items-center justify-center gap-sm p-xl text-center">
            <MaterialIcon name="history" className="text-outline" size={44} />
            <h2 className="font-headline-sm text-headline-sm">
              Log kaydı bulunamadı
            </h2>
            <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">
              Seçili filtreler için publisher veya scheduler olayı yok.
            </p>
          </section>
        ) : null}

        {!loading && logs.length > 0 ? (
          <section className="panel-card min-w-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left">
                <thead className="border-b border-outline-variant bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
                  <tr>
                    <th className="px-md py-sm">Aksiyon</th>
                    <th className="px-md py-sm">Platform</th>
                    <th className="px-md py-sm">Hesap</th>
                    <th className="px-md py-sm">Durum</th>
                    <th className="px-md py-sm">Mesaj</th>
                    <th className="px-md py-sm">Zaman</th>
                    <th className="px-md py-sm text-right">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 font-body-sm text-body-sm">
                  {logs.map((log) => {
                    const meta = platformMeta[log.platform];
                    const statusInfo = statusMeta[log.status];

                    return (
                      <tr key={log.id}>
                        <td className="px-md py-sm font-semibold">
                          {log.action}
                        </td>
                        <td className="px-md py-sm">
                          <span className="inline-flex items-center gap-xs">
                            <MaterialIcon name={meta.icon} size={18} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="max-w-[220px] truncate px-md py-sm">
                          {log.accountLabel}
                        </td>
                        <td className="px-md py-sm">
                          <StatusBadge tone={statusInfo.tone}>
                            {statusInfo.label}
                          </StatusBadge>
                        </td>
                        <td className="max-w-[320px] truncate px-md py-sm text-on-surface-variant">
                          {logMessage(log)}
                        </td>
                        <td className="px-md py-sm text-on-surface-variant">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-md py-sm text-right">
                          <button
                            className="secondary-button px-3 py-1.5 font-label-sm text-label-sm"
                            type="button"
                            onClick={() => setSelectedLog(log)}
                          >
                            Detay
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {selectedLog ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-md">
            <section className="panel-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-md shadow-panel">
              <div className="mb-md flex items-start justify-between gap-md">
                <div>
                  <h2 className="font-headline-sm text-headline-sm">
                    Log Detayı
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {selectedLog.action} ·{" "}
                    {formatDateTime(selectedLog.createdAt)}
                  </p>
                </div>
                <StatusBadge tone={statusMeta[selectedLog.status].tone}>
                  {statusMeta[selectedLog.status].label}
                </StatusBadge>
              </div>

              <dl className="grid grid-cols-1 gap-sm md:grid-cols-2">
                <DetailItem label="Platform" value={selectedLog.platform} />
                <DetailItem label="Hesap" value={selectedLog.accountLabel} />
                <DetailItem
                  label="Content Card"
                  value={selectedLog.contentCardId ?? "-"}
                />
                <DetailItem
                  label="Güncel Kart Durumu"
                  value={selectedLog.contentCard?.status ?? "-"}
                />
                <DetailItem
                  label="Log Hata Kodu"
                  value={selectedLog.errorCode ?? "-"}
                />
                <DetailItem
                  label="Log Hata Mesajı"
                  value={selectedLog.errorMessage ?? "-"}
                />
              </dl>

              {selectedLog.status === "ERROR" &&
              selectedLog.contentCard?.status === "SCHEDULED" ? (
                <div className="mt-md rounded-lg border border-blue-200 bg-blue-50 p-sm text-blue-900">
                  <p className="font-body-sm text-body-sm">
                    Bu satır eski bir yayın denemesinin hata logudur. Kart şu
                    anda yeniden planlanmış durumda; yeni yayın denemesi için en
                    güncel sonucu yeni log kaydından kontrol edin.
                  </p>
                </div>
              ) : null}

              {selectedLog.contentCard?.externalPostUrl ? (
                <a
                  className="mt-md inline-flex items-center gap-xs font-label-md text-label-md text-primary hover:underline"
                  href={selectedLog.contentCard.externalPostUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MaterialIcon name="open_in_new" size={18} />
                  Yayını Aç
                </a>
              ) : null}

              <div className="mt-md space-y-xs">
                <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                  API Response
                </p>
                <pre className="max-h-72 overflow-auto rounded-lg bg-surface-container-low p-sm font-mono text-[12px]">
                  {prettyJson(selectedLog.apiResponse)}
                </pre>
              </div>

              <div className="mt-md flex justify-end">
                <button
                  className="primary-button px-md py-sm font-label-md text-label-md"
                  type="button"
                  onClick={() => setSelectedLog(null)}
                >
                  Kapat
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-sm">
      <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">
        {label}
      </dt>
      <dd className="mt-xs break-words font-body-sm text-body-sm">{value}</dd>
    </div>
  );
}
