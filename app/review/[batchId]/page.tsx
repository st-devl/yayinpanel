"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { BulkActionBar } from "@/components/ai/bulk-action-bar";
import { ReviewCard, type ReviewItemData } from "@/components/ai/review-card";

type BatchDetail = {
  id: string;
  platform: string;
  accountId: string;
  status: string;
  totalItems: number;
  approvedItems: number;
  errorMessage: string | null;
  createdAt: string;
  aiProvider: { name: string; providerType: string; model: string };
  items: ReviewItemData[];
};

type EditModalState = {
  item: ReviewItemData;
  data: Record<string, unknown>;
  scheduledAt: string;
} | null;

export default function ReviewPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const router = useRouter();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [startDateInput, setStartDateInput] = useState("");

  useEffect(() => {
    loadBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  async function loadBatch() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/batches/${batchId}`);
      const payload = (await res.json()) as { data?: BatchDetail; error?: string };

      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "Batch yüklenemedi.");
      }

      setBatch(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  const pendingItems =
    batch?.items.filter((i) =>
      ["READY", "EDITED", "PENDING"].includes(i.reviewStatus)
    ) ?? [];

  const hasAmbiguousSchedule = pendingItems.some(
    (i) =>
      !i.scheduledAt &&
      (JSON.parse(i.warnings) as string[]).includes("AMBIGUOUS_SCHEDULE")
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setSelectedIds(pendingItems.map((i) => i.id));
  }

  function deselectAll() {
    setSelectedIds([]);
  }

  async function approveItem(itemId: string) {
    setBusy(true);

    try {
      const res = await fetch(
        `/api/batches/${batchId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" })
        }
      );

      if (!res.ok) {
        const p = (await res.json()) as { error?: string };
        throw new Error(p.error ?? "Onaylanamadı.");
      }

      await loadBatch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onay başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectItem(itemId: string) {
    setBusy(true);

    try {
      await fetch(`/api/batches/${batchId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" })
      });
      await loadBatch();
    } finally {
      setBusy(false);
    }
  }

  async function bulkApprove(ids?: string[]) {
    setBusy(true);

    try {
      const res = await fetch(`/api/batches/${batchId}/bulk-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: ids })
      });
      const p = (await res.json()) as { approved?: number; error?: string };

      if (!res.ok) throw new Error(p.error ?? "Toplu onay başarısız.");

      await loadBatch();
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toplu onay başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function bulkReject(ids?: string[]) {
    setBusy(true);

    try {
      await fetch(`/api/batches/${batchId}/bulk-reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: ids })
      });
      await loadBatch();
      setSelectedIds([]);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editModal) return;

    setBusy(true);

    try {
      await fetch(
        `/api/batches/${batchId}/items/${editModal.item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            proposedPlatformData: editModal.data,
            scheduledAt: editModal.scheduledAt || null
          })
        }
      );
      setEditModal(null);
      await loadBatch();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="İçerik Onay">
        <div className="flex min-h-[400px] items-center justify-center font-body-md text-body-md text-on-surface-variant">
          Yükleniyor...
        </div>
      </AppShell>
    );
  }

  if (error && !batch) {
    return (
      <AppShell title="İçerik Onay">
        <div className="rounded-xl border border-error/20 bg-error-container p-md text-on-error-container">
          <p className="font-body-sm text-body-sm">{error}</p>
        </div>
      </AppShell>
    );
  }

  if (!batch) return null;

  const approvedCount = batch.items.filter(
    (i) => i.reviewStatus === "APPROVED"
  ).length;
  const rejectedCount = batch.items.filter(
    (i) => i.reviewStatus === "REJECTED"
  ).length;

  return (
    <AppShell title="İçerik Onay">
      <div className="space-y-lg">
        {/* Batch özeti */}
        <section className="panel-card p-md">
          <div className="flex flex-wrap items-start justify-between gap-md">
            <div>
              <div className="flex items-center gap-sm">
                <MaterialIcon name="auto_awesome" className="text-primary" />
                <h1 className="font-headline-md text-headline-md">
                  Yapay Zekâ Analiz Sonuçları
                </h1>
              </div>
              <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
                {batch.aiProvider.name} · {batch.aiProvider.model} ·{" "}
                {formatDate(batch.createdAt)}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-sm text-center">
              {[
                { label: "Toplam", value: batch.totalItems },
                { label: "Bekleyen", value: pendingItems.length },
                { label: "Onaylanan", value: approvedCount },
                { label: "Reddedilen", value: rejectedCount }
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    {label}
                  </p>
                  <p className="font-headline-sm text-headline-sm">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tarih uyarısı */}
        {hasAmbiguousSchedule && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-md">
            <div className="flex items-start gap-sm">
              <MaterialIcon name="warning" className="mt-0.5 text-amber-600" />
              <div className="flex-1">
                <p className="font-label-md text-label-md text-amber-800">
                  Yayın tarihi belirsiz içerikler var
                </p>
                <p className="font-body-sm text-body-sm text-amber-700">
                  Aşağıdaki içeriklerden bazılarının yayın tarihi belirlenemedi.
                  Onaylamadan önce her içeriğin tarihini düzenleyebilirsiniz.
                </p>
                <div className="mt-sm flex items-center gap-sm">
                  <input
                    type="datetime-local"
                    className="input-surface rounded-lg px-3 py-1.5 font-body-sm text-body-sm"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                  />
                  <span className="font-body-sm text-body-sm text-amber-700">
                    Başlangıç tarihi seçin (tarih belirsiz içerikler için uygulanır)
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Hata */}
        {error && (
          <div className="rounded-xl border border-error/20 bg-error-container p-md text-on-error-container">
            <p className="font-body-sm text-body-sm">{error}</p>
          </div>
        )}

        {/* Toplu aksiyonlar */}
        {pendingItems.length > 0 && (
          <BulkActionBar
            totalCount={pendingItems.length}
            selectedIds={selectedIds}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onBulkApprove={bulkApprove}
            onBulkReject={bulkReject}
            busy={busy}
          />
        )}

        {/* Kartlar */}
        {batch.items.length === 0 ? (
          <div className="panel-card flex min-h-[300px] flex-col items-center justify-center gap-sm p-xl text-center">
            <MaterialIcon name="inbox" className="text-outline" size={44} />
            <p className="font-headline-sm text-headline-sm">İçerik bulunamadı</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
            {batch.items.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                selected={selectedIds.includes(item.id)}
                onSelect={toggleSelect}
                onApprove={approveItem}
                onReject={rejectItem}
                onEdit={(i) => {
                  const data = JSON.parse(i.proposedPlatformData) as Record<
                    string,
                    unknown
                  >;
                  setEditModal({
                    item: i,
                    data,
                    scheduledAt: i.scheduledAt
                      ? new Date(i.scheduledAt).toISOString().slice(0, 16)
                      : ""
                  });
                }}
                busy={busy}
              />
            ))}
          </div>
        )}

        {/* Tümü tamamlandıysa */}
        {pendingItems.length === 0 && batch.items.length > 0 && (
          <div className="panel-card flex flex-col items-center gap-md p-xl text-center">
            <MaterialIcon name="check_circle" className="text-success" size={48} />
            <div>
              <p className="font-headline-sm text-headline-sm">
                Tüm içerikler işlendi
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {approvedCount} içerik onaylandı ve yayın kuyruğuna alındı.
              </p>
            </div>
            <button
              type="button"
              className="primary-button px-lg py-sm font-label-md text-label-md"
              onClick={() => router.push("/content")}
            >
              İçerik Deposuna Git
            </button>
          </div>
        )}
      </div>

      {/* Düzenleme modalı */}
      {editModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-md">
          <section className="panel-card w-full max-w-2xl space-y-md overflow-y-auto p-md shadow-panel max-h-[90vh]">
            <div className="flex items-center justify-between gap-md">
              <h2 className="font-headline-sm text-headline-sm">
                İçeriği Düzenle
              </h2>
              <button
                type="button"
                className="text-outline hover:text-on-surface"
                onClick={() => setEditModal(null)}
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <div className="space-y-sm">
              {Object.entries(editModal.data).map(([key, value]) => (
                <label key={key} className="block space-y-xs">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {key}
                  </span>
                  {typeof value === "string" && value.length > 100 ? (
                    <textarea
                      className="input-surface w-full resize-y rounded-lg px-3 py-2 font-body-sm text-body-sm"
                      rows={4}
                      value={value}
                      onChange={(e) =>
                        setEditModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                data: { ...prev.data, [key]: e.target.value }
                              }
                            : null
                        )
                      }
                    />
                  ) : (
                    <input
                      type="text"
                      className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                      value={typeof value === "string" ? value : JSON.stringify(value)}
                      onChange={(e) =>
                        setEditModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                data: { ...prev.data, [key]: e.target.value }
                              }
                            : null
                        )
                      }
                    />
                  )}
                </label>
              ))}

              <label className="block space-y-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Yayın Tarihi ve Saati
                </span>
                <input
                  type="datetime-local"
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  value={editModal.scheduledAt}
                  onChange={(e) =>
                    setEditModal((prev) =>
                      prev ? { ...prev, scheduledAt: e.target.value } : null
                    )
                  }
                />
              </label>
            </div>

            <div className="flex justify-end gap-sm pt-sm">
              <button
                type="button"
                className="secondary-button px-md py-sm font-label-md text-label-md"
                onClick={() => setEditModal(null)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="primary-button px-md py-sm font-label-md text-label-md"
                disabled={busy}
                onClick={saveEdit}
              >
                Kaydet
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(new Date(iso));
}
