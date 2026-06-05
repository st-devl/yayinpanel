import { Platform } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  getAccountSummaries,
  getConnectionAlerts,
  getDashboardMetrics,
  getRecentPublishActivity
} from "@/lib/server/dashboard";
import { formatPanelDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const platformIcons: Record<
  Platform,
  { icon: string; className: string; label: string }
> = {
  [Platform.INSTAGRAM]: {
    icon: "photo_camera",
    className: "text-pink-600",
    label: "Instagram"
  },
  [Platform.X]: {
    icon: "share",
    className: "text-blue-500",
    label: "X / Twitter"
  },
  [Platform.WORDPRESS]: {
    icon: "web",
    className: "text-gray-700",
    label: "Web Sitesi"
  },
  [Platform.CUSTOM_SITE]: {
    icon: "code",
    className: "text-violet-600",
    label: "Özel Site"
  }
};

export default async function DashboardPage() {
  const [metrics, summaries, alerts, activity] = await Promise.all([
    getDashboardMetrics(),
    getAccountSummaries(),
    getConnectionAlerts(),
    getRecentPublishActivity()
  ]);

  return (
    <AppShell searchPlaceholder="Hızlı ara...">
      <div className="space-y-lg">
        <section className="grid grid-cols-1 gap-md md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            icon="calendar_today"
            label="Bugün Paylaşılacak"
            value={metrics.todayScheduled}
            eyebrow="Bugün"
            tone="blue"
          />
          <StatCard
            icon="schedule"
            label="Planlanmış İçerik"
            value={metrics.scheduled}
            eyebrow="Bekleyen"
            tone="indigo"
          />
          <StatCard
            icon="check_circle"
            label="Yayınlanmış İçerik"
            value={metrics.published}
            eyebrow="Toplam"
            tone="green"
          />
          <StatCard
            icon="error"
            label="Hata Alan İçerik"
            value={metrics.failed}
            eyebrow="Kritik"
            tone="red"
          />
          <StatCard
            icon="pending_actions"
            label="Manuel Kontrol"
            value={metrics.manualCheck}
            eyebrow="İşlem"
            tone="amber"
          />
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-lg xl:grid-cols-3">
          <div className="space-y-lg xl:col-span-1">
            <section className="panel-card p-md">
              <div className="mb-md flex items-center justify-between gap-md">
                <h3 className="font-headline-sm text-headline-sm">
                  Bağlı Hesaplar
                </h3>
                <a
                  className="font-label-md text-label-md text-primary hover:underline"
                  href="/accounts"
                >
                  Tümünü Gör
                </a>
              </div>
              <div className="space-y-sm">
                {summaries.map((summary) => {
                  const meta = platformIcons[summary.platform];
                  return (
                    <div
                      key={summary.platform}
                      className="flex items-center justify-between rounded-lg bg-surface p-sm"
                    >
                      <div className="flex items-center gap-sm">
                        <MaterialIcon
                          name={meta.icon}
                          className={meta.className}
                        />
                        <span className="font-body-md text-body-md">
                          {meta.label}
                        </span>
                      </div>
                      <StatusBadge
                        tone={summary.connected > 0 ? "success" : "neutral"}
                      >
                        {summary.connected} Aktif
                        {summary.needsAttention > 0
                          ? ` · ${summary.needsAttention} uyarı`
                          : ""}
                      </StatusBadge>
                    </div>
                  );
                })}
              </div>
            </section>

            {alerts.length > 0 ? (
              <section className="rounded-xl border border-error bg-error-container p-md text-on-error-container">
                <div className="flex items-start gap-sm">
                  <MaterialIcon name="warning" className="mt-1 text-error" />
                  <div className="min-w-0">
                    <h3 className="mb-1 font-label-md text-label-md font-bold">
                      Hesap & Token Uyarıları
                    </h3>
                    <ul className="space-y-xs font-body-sm text-body-sm">
                      {alerts.slice(0, 4).map((alert, index) => (
                        <li key={`${alert.name}-${index}`}>
                          <span className="font-semibold">{alert.name}</span> —{" "}
                          {alert.message ?? alert.status}
                        </li>
                      ))}
                    </ul>
                    <a
                      className="mt-sm inline-block rounded-lg bg-error px-4 py-2 font-label-md text-label-md text-on-error"
                      href="/accounts"
                    >
                      Hesapları Yönet
                    </a>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <div className="min-w-0 space-y-lg xl:col-span-2">
            <section className="panel-card min-w-0 p-md">
              <h3 className="mb-md font-headline-sm text-headline-sm">
                Son Başarılı Yayınlar
              </h3>
              {activity.recentSuccess.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Henüz başarılı yayın yok.
                </p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[450px] text-left">
                    <thead className="border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant">
                      <tr>
                        <th className="px-sm pb-sm">Platform</th>
                        <th className="px-sm pb-sm">Aksiyon</th>
                        <th className="px-sm pb-sm">Bağlantı</th>
                        <th className="px-sm pb-sm">Zaman</th>
                      </tr>
                    </thead>
                    <tbody className="font-body-sm text-body-sm">
                      {activity.recentSuccess.map((log) => {
                        const meta = platformIcons[log.platform];
                        return (
                          <tr key={log.id} className="border-b border-surface">
                            <td className="px-sm py-sm">
                              <MaterialIcon
                                name={meta.icon}
                                className={meta.className}
                              />
                            </td>
                            <td className="px-sm py-sm">{log.action}</td>
                            <td className="px-sm py-sm">
                              {log.contentCard?.externalPostUrl ? (
                                <a
                                  className="text-primary hover:underline"
                                  href={log.contentCard.externalPostUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Görüntüle
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-sm py-sm text-on-surface-variant">
                              {formatPanelDateTime(log.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel-card p-md">
              <h3 className="mb-md font-headline-sm text-headline-sm">
                Son Hatalar
              </h3>
              {activity.recentErrors.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Son dönemde hata kaydı yok.
                </p>
              ) : (
                <div className="space-y-sm">
                  {activity.recentErrors.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-md rounded-lg border-l-4 border-error bg-surface-container-low p-sm"
                    >
                      <MaterialIcon
                        name="cancel"
                        className="shrink-0 text-error"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap justify-between gap-sm">
                          <p className="font-label-md text-label-md font-bold">
                            {log.platform} · {log.errorCode ?? log.action}
                          </p>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            {formatPanelDateTime(log.createdAt)}
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          {log.errorMessage ?? "Bilinmeyen hata"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
