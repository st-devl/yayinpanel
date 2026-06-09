"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
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

type EditField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "tags" | "lines" | "checkbox";
  help?: string;
  rows?: number;
};

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
      const payload = (await res.json()) as {
        data?: BatchDetail;
        error?: string;
      };

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

  const pendingItems = useMemo(
    () =>
      batch?.items.filter((i) =>
        ["READY", "EDITED", "PENDING"].includes(i.reviewStatus)
      ) ?? [],
    [batch?.items]
  );
  const selectableIds = useMemo(
    () => new Set(pendingItems.map((item) => item.id)),
    [pendingItems]
  );
  const selectedPendingIds = useMemo(
    () => selectedIds.filter((id) => selectableIds.has(id)),
    [selectedIds, selectableIds]
  );

  const hasAmbiguousSchedule = pendingItems.some(
    (i) =>
      !i.scheduledAt &&
      (JSON.parse(i.warnings) as string[]).includes("AMBIGUOUS_SCHEDULE")
  );

  function toggleSelect(id: string) {
    if (!selectableIds.has(id)) {
      return;
    }

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
      const res = await fetch(`/api/batches/${batchId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" })
      });

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

  async function deleteItem(itemId: string) {
    setBusy(true);

    try {
      const res = await fetch(`/api/batches/${batchId}/items/${itemId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const p = (await res.json()) as { error?: string };
        throw new Error(p.error ?? "Silinemedi.");
      }

      setSelectedIds((prev) => prev.filter((x) => x !== itemId));
      await loadBatch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silme başarısız.");
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

  async function bulkDelete(ids?: string[]) {
    const count = ids?.length ?? pendingItems.length;

    if (count === 0) {
      return;
    }

    if (
      !window.confirm(
        ids?.length
          ? `${count} seçili içerik silinsin mi?`
          : `${count} onay bekleyen içerik silinsin mi?`
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(`/api/batches/${batchId}/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: ids })
      });
      const payload = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(payload.error ?? "Toplu silme başarısız.");
      }

      await loadBatch();
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toplu silme başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editModal) return;

    setBusy(true);

    try {
      await fetch(`/api/batches/${batchId}/items/${editModal.item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          proposedPlatformData: editModal.data,
          scheduledAt: editModal.scheduledAt
            ? new Date(editModal.scheduledAt).toISOString()
            : null
        })
      });
      setEditModal(null);
      await loadBatch();
    } finally {
      setBusy(false);
    }
  }

  function updateEditField(key: string, value: unknown) {
    setEditModal((prev) =>
      prev ? { ...prev, data: { ...prev.data, [key]: value } } : null
    );
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
                    Başlangıç tarihi seçin (tarih belirsiz içerikler için
                    uygulanır)
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
            selectedIds={selectedPendingIds}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onBulkApprove={bulkApprove}
            onBulkReject={bulkReject}
            onBulkDelete={bulkDelete}
            busy={busy}
          />
        )}

        {/* Kartlar */}
        {batch.items.length === 0 ? (
          <div className="panel-card flex min-h-[300px] flex-col items-center justify-center gap-sm p-xl text-center">
            <MaterialIcon name="inbox" className="text-outline" size={44} />
            <p className="font-headline-sm text-headline-sm">
              İçerik bulunamadı
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
            {batch.items.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                selected={selectedPendingIds.includes(item.id)}
                onSelect={toggleSelect}
                onApprove={approveItem}
                onReject={rejectItem}
                onDelete={deleteItem}
                onEdit={(i) => {
                  const data = normalizeEditableData(
                    i,
                    JSON.parse(i.proposedPlatformData) as Record<
                      string,
                      unknown
                    >
                  );
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
            <MaterialIcon
              name="check_circle"
              className="text-success"
              size={48}
            />
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
          <section className="panel-card max-h-[90vh] w-full max-w-2xl space-y-md overflow-y-auto p-md shadow-panel">
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
              {editableFieldsForItem(editModal.item, editModal.data).map(
                (field) => {
                  const value = editModal.data[field.key];

                  return (
                    <label key={field.key} className="block space-y-xs">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {field.label}
                      </span>
                      {field.help ? (
                        <span className="block font-body-sm text-body-sm text-outline">
                          {field.help}
                        </span>
                      ) : null}
                      {field.type === "textarea" ? (
                        <textarea
                          className="input-surface w-full resize-y rounded-lg px-3 py-2 font-body-sm text-body-sm"
                          rows={field.rows ?? 4}
                          value={stringValue(value)}
                          onChange={(e) =>
                            updateEditField(field.key, e.target.value)
                          }
                        />
                      ) : field.type === "lines" ? (
                        <textarea
                          className="input-surface w-full resize-y rounded-lg px-3 py-2 font-body-sm text-body-sm"
                          rows={field.rows ?? 4}
                          value={arrayValue(value).join("\n")}
                          onChange={(e) =>
                            updateEditField(
                              field.key,
                              e.target.value
                                .split("\n")
                                .map((line) => line.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                      ) : field.type === "tags" ? (
                        <input
                          type="text"
                          className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                          value={arrayValue(value).join(", ")}
                          onChange={(e) =>
                            updateEditField(
                              field.key,
                              e.target.value
                                .split(",")
                                .map((part) => part.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                      ) : field.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={Boolean(value)}
                          onChange={(e) =>
                            updateEditField(field.key, e.target.checked)
                          }
                        />
                      ) : (
                        <input
                          type="text"
                          className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                          value={stringValue(value)}
                          onChange={(e) =>
                            updateEditField(field.key, e.target.value)
                          }
                        />
                      )}
                    </label>
                  );
                }
              )}

              {uneditableTechnicalFields(editModal.data).length > 0 ? (
                <details className="rounded-lg border border-outline-variant p-sm">
                  <summary className="cursor-pointer font-label-sm text-label-sm text-on-surface-variant">
                    Teknik alanlar
                  </summary>
                  <div className="mt-sm grid grid-cols-1 gap-sm md:grid-cols-2">
                    {uneditableTechnicalFields(editModal.data).map(
                      ([key, value]) => (
                        <div key={key}>
                          <p className="font-label-sm text-label-sm text-outline">
                            {technicalFieldLabel(key)}
                          </p>
                          <p className="break-words font-body-sm text-body-sm">
                            {formatTechnicalValue(value)}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </details>
              ) : null}

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

function normalizeEditableData(
  item: ReviewItemData,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (item.platform === "X") {
    const mediaAssignments = parseMediaAssignments(item.mediaAssignments);

    return {
      ...data,
      hasMedia: Boolean(data.hasMedia) || mediaAssignments.length > 0,
      isThread: Boolean(data.isThread) || item.contentType === "x_thread",
      linkUrl: stringValue(data.linkUrl),
      threadItems: arrayValue(data.threadItems),
      tweetText: stringValue(data.tweetText)
    };
  }

  if (item.platform === "INSTAGRAM") {
    return {
      ...data,
      caption: stringValue(data.caption),
      captionStyle: stringValue(data.captionStyle) || "standard",
      hashtags: arrayValue(data.hashtags),
      postType: stringValue(data.postType) || "IMAGE"
    };
  }

  return {
    ...data,
    categories: arrayValue(data.categories),
    categoryIds: arrayValue(data.categoryIds),
    contentHtml: stringValue(data.contentHtml),
    excerpt: stringValue(data.excerpt),
    publishStatus: stringValue(data.publishStatus) || "publish",
    seoDescription: stringValue(data.seoDescription),
    seoTitle: stringValue(data.seoTitle),
    slug: stringValue(data.slug),
    tagIds: arrayValue(data.tagIds),
    tags: arrayValue(data.tags),
    title: stringValue(data.title)
  };
}

function editableFieldsForItem(
  item: ReviewItemData,
  data: Record<string, unknown>
): EditField[] {
  if (item.platform === "X") {
    const fields: EditField[] = [
      {
        key: "tweetText",
        label: "Gönderi metni",
        type: "textarea",
        rows: 5,
        help: "X'te paylaşılacak ana metin. 280 karakter sınırını aşmayın."
      },
      {
        key: "linkUrl",
        label: "Bağlantı URL'si",
        type: "text",
        help: "Opsiyonel. Doluysa gönderi metninin sonuna eklenir."
      }
    ];

    if (Boolean(data.isThread) || arrayValue(data.threadItems).length > 0) {
      fields.push({
        key: "threadItems",
        label: "Ek tweetler",
        type: "lines",
        rows: 4,
        help: "Her satır ayrı ek tweet olarak saklanır. Otomatik thread yayını şu an desteklenmiyorsa ana metni tek gönderi olarak düzenleyin."
      });
    }

    return fields;
  }

  if (item.platform === "INSTAGRAM") {
    return [
      {
        key: "caption",
        label: "Açıklama metni",
        type: "textarea",
        rows: 6
      },
      {
        key: "hashtags",
        label: "Hashtagler",
        type: "tags",
        help: "Virgülle ayırın. # işareti yazmanız gerekmez."
      }
    ];
  }

  return [
    { key: "title", label: "Başlık", type: "text" },
    { key: "slug", label: "URL kısa adı", type: "text" },
    { key: "contentHtml", label: "İçerik", type: "textarea", rows: 8 },
    { key: "excerpt", label: "Özet", type: "textarea", rows: 3 },
    { key: "seoTitle", label: "SEO başlığı", type: "text" },
    {
      key: "seoDescription",
      label: "SEO açıklaması",
      type: "textarea",
      rows: 3
    },
    {
      key: "categories",
      label: "Kategoriler",
      type: "tags",
      help: "Virgülle ayırın."
    },
    { key: "tags", label: "Etiketler", type: "tags", help: "Virgülle ayırın." }
  ];
}

function uneditableTechnicalFields(data: Record<string, unknown>) {
  const technicalKeys = new Set([
    "captionStyle",
    "categoryIds",
    "hasMedia",
    "isThread",
    "platform",
    "postType",
    "publishStatus",
    "tagIds"
  ]);

  return Object.entries(data).filter(([key]) => technicalKeys.has(key));
}

function technicalFieldLabel(key: string) {
  const labels: Record<string, string> = {
    captionStyle: "Açıklama stili",
    categoryIds: "Kategori ID'leri",
    hasMedia: "Görsel atanmış mı",
    isThread: "Seri gönderi mi",
    platform: "Platform",
    postType: "Gönderi tipi",
    publishStatus: "Yayın durumu",
    tagIds: "Etiket ID'leri"
  };

  return labels[key] ?? key;
}

function formatTechnicalValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Evet" : "Hayır";
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function parseMediaAssignments(value: string): Array<{ fileId: string }> {
  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is { fileId: string } =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as { fileId?: unknown }).fileId === "string"
      )
    );
  } catch {
    return [];
  }
}
