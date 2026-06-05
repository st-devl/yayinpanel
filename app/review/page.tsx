import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { listPendingBatches } from "@/lib/server/processing-batches";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  X: "X / Twitter",
  WORDPRESS: "WordPress",
  CUSTOM_SITE: "Özel Site"
};

const STATUS_LABELS: Record<string, string> = {
  REVIEW_PENDING: "Onay Bekliyor",
  PARTIALLY_APPROVED: "Kısmen Onaylandı",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız"
};

export default async function ReviewIndexPage() {
  const batches = await listPendingBatches();

  return (
    <AppShell title="Onay Bekleyenler">
      <div className="space-y-lg">
        <section className="flex items-start justify-between gap-md">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Onay Bekleyenler
            </h1>
            <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
              Yapay zekâ tarafından işlenen ve kullanıcı onayı bekleyen içerik
              grupları.
            </p>
          </div>
        </section>

        {batches.length === 0 ? (
          <div className="panel-card flex min-h-[320px] flex-col items-center justify-center gap-sm p-xl text-center">
            <MaterialIcon name="pending_actions" className="text-outline" size={48} />
            <p className="font-headline-sm text-headline-sm">
              Onay bekleyen içerik yok
            </p>
            <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">
              Blog, Instagram veya X panellerinden "AI ile Toplu Yükle" seçeneğini
              kullanarak içerik yükleyin.
            </p>
            <div className="mt-sm flex flex-wrap justify-center gap-sm">
              <Link
                href="/blog"
                className="secondary-button px-md py-sm font-label-md text-label-md"
              >
                <MaterialIcon name="web" size={16} />
                Blog Paneli
              </Link>
              <Link
                href="/instagram"
                className="secondary-button px-md py-sm font-label-md text-label-md"
              >
                <MaterialIcon name="photo_camera" size={16} />
                Instagram Paneli
              </Link>
              <Link
                href="/x"
                className="secondary-button px-md py-sm font-label-md text-label-md"
              >
                <MaterialIcon name="share" size={16} />
                X Paneli
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
            {batches.map((batch) => {
              const batchWithCount = batch as typeof batch & {
                _count?: { items: number };
              };
              const count =
                batchWithCount._count?.items ?? batch.totalItems;

              return (
                <Link
                  key={batch.id}
                  href={`/review/${batch.id}`}
                  className="panel-card flex flex-col gap-sm p-md transition-shadow hover:shadow-panel-sm"
                >
                  <div className="flex items-start justify-between gap-sm">
                    <div className="flex items-center gap-xs">
                      <MaterialIcon name="auto_awesome" className="text-primary" size={20} />
                      <span className="font-label-md text-label-md">
                        {PLATFORM_LABELS[batch.platform] ?? batch.platform}
                      </span>
                    </div>
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-xs py-0.5 font-label-sm text-label-sm text-amber-700">
                      {STATUS_LABELS[batch.status] ?? batch.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-sm font-body-sm text-body-sm text-on-surface-variant">
                    <span>{count} içerik</span>
                    <span>·</span>
                    <span>{batch.approvedItems} onaylandı</span>
                    <span>·</span>
                    <span>
                      {new Intl.DateTimeFormat("tr-TR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Europe/Istanbul"
                      }).format(new Date(batch.createdAt))}
                    </span>
                  </div>

                  <div className="flex items-center gap-xs font-body-sm text-body-sm text-primary">
                    <span>İncele ve Onayla</span>
                    <MaterialIcon name="arrow_forward" size={16} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
