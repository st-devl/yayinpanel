"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { BulkUploadZone, type UploadedFile } from "@/components/ai/bulk-upload-zone";
import { InstructionInput } from "@/components/ai/instruction-input";
import { ProcessingIndicator } from "@/components/ai/processing-indicator";

type WordPressSite = {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  connectionStatus: string;
  lastError: string | null;
};

type CustomSite = {
  id: string;
  name: string;
  baseUrl: string;
  connectionStatus: string;
  lastError: string | null;
};

type AnySite =
  | (WordPressSite & { platform: "WORDPRESS" })
  | (CustomSite & { platform: "CUSTOM_SITE" });

type MediaFile = {
  id: string;
  originalFileName: string;
  fileSize: number;
};

type RequestState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const featuredImage =
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80";

function createSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replaceAll("ğ", "g")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ı", "i")
      .replaceAll("ö", "o")
      .replaceAll("ç", "c") || "yeni-icerik-basligi"
  );
}

function parseNumberList(value: string) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getIstanbulDateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric"
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`
  };
}

function statusTone(status: string) {
  if (status === "CONNECTED") return "success" as const;
  if (status === "DISCONNECTED") return "neutral" as const;
  if (status === "NEEDS_RECONNECT" || status === "RATE_LIMITED") {
    return "warning" as const;
  }
  return "error" as const;
}

export default function BlogPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");
  const [sites, setSites] = useState<AnySite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");

  // AI tab state
  const [aiFiles, setAiFiles] = useState<UploadedFile[]>([]);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("yeni-icerik-basligi");
  const [slugEdited, setSlugEdited] = useState(false);
  const [contentHtml, setContentHtml] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [categoryIds, setCategoryIds] = useState("");
  const [tagIds, setTagIds] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [featuredMedia, setFeaturedMedia] = useState<MediaFile | null>(null);
  const [status, setStatus] = useState<RequestState>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSites() {
      try {
        const [wpRes, csRes] = await Promise.all([
          fetch("/api/accounts/wordpress"),
          fetch("/api/accounts/custom-sites")
        ]);

        const [wpPayload, csPayload] = await Promise.all([
          wpRes.json() as Promise<{ data?: WordPressSite[] }>,
          csRes.json() as Promise<{ data?: CustomSite[] }>
        ]);

        if (!wpRes.ok) throw new Error("WordPress siteleri alınamadı.");
        if (!csRes.ok) throw new Error("Özel siteler alınamadı.");

        if (active) {
          const nextSites: AnySite[] = [
            ...(wpPayload.data ?? []).map((s) => ({
              ...s,
              platform: "WORDPRESS" as const
            })),
            ...(csPayload.data ?? []).map((s) => ({
              ...s,
              platform: "CUSTOM_SITE" as const
            }))
          ];
          setSites(nextSites);
          setSelectedSiteId(
            nextSites.find((site) => site.connectionStatus === "CONNECTED")
              ?.id ??
              nextSites[0]?.id ??
              ""
          );
        }
      } catch (error) {
        if (active) {
          setStatus({
            tone: "error",
            message:
              error instanceof Error ? error.message : "Siteler alınamadı."
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSites();

    return () => {
      active = false;
    };
  }, []);

  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const selectedPlatform = selectedSite?.platform ?? "WORDPRESS";
  const contentSummary = useMemo(
    () => stripHtml(contentHtml).slice(0, 220),
    [contentHtml]
  );
  const canSubmit =
    Boolean(selectedSiteId) &&
    title.trim().length > 0 &&
    slug.trim().length > 0 &&
    contentHtml.trim().length > 0 &&
    !submitting;

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugEdited) {
      setSlug(createSlug(value));
    }
  }

  async function handleFeaturedImageUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/media", {
        body: formData,
        method: "POST"
      });
      const payload = (await response.json()) as {
        data?: MediaFile;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Öne çıkan görsel yüklenemedi.");
      }

      setFeaturedMedia(payload.data);
      setStatus({
        tone: "success",
        message: "Öne çıkan görsel medya kütüphanesine yüklendi."
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Öne çıkan görsel yüklenemedi."
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleAIProcess() {
    if (!selectedSiteId) {
      setAiError("Önce hedef site seçin.");
      return;
    }

    if (aiFiles.length === 0) {
      setAiError("İşlenecek dosya yükleyin.");
      return;
    }

    setAiProcessing(true);
    setAiError(null);

    try {
      const uploadedMediaIds: string[] = [];
      const uploadedDocIds: string[] = [];

      for (const f of aiFiles) {
        const formData = new FormData();
        formData.append("file", f.file);
        const res = await fetch("/api/media", { method: "POST", body: formData });
        const payload = (await res.json()) as { data?: { id: string }; error?: string };

        if (!res.ok || !payload.data) {
          throw new Error(payload.error ?? `${f.file.name} yüklenemedi.`);
        }

        if (f.type === "image") {
          uploadedMediaIds.push(payload.data.id);
        } else {
          uploadedDocIds.push(payload.data.id);
        }
      }

      const platform = selectedPlatform === "WORDPRESS" ? "WORDPRESS" : "CUSTOM_SITE";
      const res = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          accountId: selectedSiteId,
          mediaFileIds: uploadedMediaIds,
          documentFileIds: uploadedDocIds,
          instructionText: aiInstruction
        })
      });

      const payload = (await res.json()) as {
        data?: { batchId: string };
        error?: string;
      };

      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "İşleme başarısız.");
      }

      router.push(`/review/${payload.data.batchId}`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "İşleme başarısız.");
      setAiProcessing(false);
    }
  }

  async function createBlogCard(mode: "draft" | "publish_now" | "schedule") {
    if (!selectedSiteId) {
      setStatus({
        tone: "error",
        message: "Önce aktif bir site seçmelisiniz."
      });
      return;
    }

    if (!canSubmit) {
      setStatus({
        tone: "error",
        message: "Başlık, slug ve içerik alanları zorunludur."
      });
      return;
    }

    const scheduleParts =
      mode === "publish_now"
        ? getIstanbulDateTimeParts()
        : mode === "schedule"
          ? {
              date: scheduledAt.split("T")[0],
              time: scheduledAt.split("T")[1]
            }
          : null;

    if (mode === "schedule" && (!scheduleParts?.date || !scheduleParts?.time)) {
      setStatus({
        tone: "error",
        message: "Planlama için yayınlanma zamanı seçin."
      });
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/content", {
        body: JSON.stringify({
          accountId: selectedSiteId,
          items: [
            {
              mediaFileId: featuredMedia?.id,
              platformData:
                selectedPlatform === "WORDPRESS"
                  ? {
                      categoryIds: parseNumberList(categoryIds),
                      contentHtml,
                      excerpt,
                      publishStatus: mode === "draft" ? "draft" : "publish",
                      seoDescription,
                      seoTitle,
                      slug: slug.trim(),
                      tagIds: parseNumberList(tagIds),
                      title: title.trim()
                    }
                  : {
                      categories: categoryIds
                        ? categoryIds.split(",").map((c) => c.trim()).filter(Boolean)
                        : [],
                      contentHtml,
                      excerpt,
                      publishStatus: mode === "draft" ? "draft" : "publish",
                      seoDescription,
                      seoTitle,
                      slug: slug.trim() || undefined,
                      tags: tagIds
                        ? tagIds.split(",").map((t) => t.trim()).filter(Boolean)
                        : [],
                      title: title.trim()
                    },
              text: excerpt || contentSummary || title.trim()
            }
          ],
          platform: selectedPlatform,
          saveAsDraft: mode === "draft",
          schedule: scheduleParts
            ? {
                frequency: "daily",
                skipWeekends: false,
                startDate: scheduleParts.date,
                startTime: scheduleParts.time
              }
            : undefined
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Blog kartı oluşturulamadı.");
      }

      setStatus({
        tone: "success",
        message:
          mode === "draft"
            ? "Blog kartı taslak olarak kaydedildi."
            : mode === "publish_now"
              ? "Blog kartı hemen yayınlanmak üzere kuyruğa alındı."
              : "Blog kartı uygulama scheduler kuyruğunda planlandı."
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Blog kartı oluşturulamadı."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Blog Paneli"
      topbarSlot={
        <select
          className="input-surface hidden max-w-xs rounded-lg px-4 py-2 font-body-md text-body-md sm:block"
          disabled={loading || sites.length === 0}
          value={selectedSiteId}
          onChange={(event) => setSelectedSiteId(event.target.value)}
        >
          {sites.length === 0 ? (
            <option value="">
              {loading ? "Siteler yükleniyor..." : "Bağlı site yok"}
            </option>
          ) : null}
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}{" "}
              {site.platform === "CUSTOM_SITE" ? "(Özel Site)" : "(WordPress)"}
            </option>
          ))}
        </select>
      }
    >
      {/* Tab bar */}
      <div className="mb-md flex gap-xs rounded-xl border border-outline-variant bg-surface-container-low p-xs">
        {(["manual", "ai"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`flex flex-1 items-center justify-center gap-xs rounded-lg px-md py-sm font-label-md text-label-md transition-colors ${
              activeTab === tab
                ? "bg-surface shadow-sm text-on-surface"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            <MaterialIcon
              name={tab === "manual" ? "edit" : "auto_awesome"}
              size={18}
            />
            {tab === "manual" ? "Tek Yazı" : "AI ile Toplu Yükle"}
          </button>
        ))}
      </div>

      {/* AI Tab */}
      {activeTab === "ai" && (
        <div className="space-y-md">
          {aiProcessing ? (
            <ProcessingIndicator fileCount={aiFiles.length} />
          ) : (
            <>
              <section className="panel-card p-md">
                <div className="mb-md flex items-center gap-sm">
                  <MaterialIcon name="auto_awesome" className="text-primary" />
                  <h2 className="font-headline-sm text-headline-sm">
                    Yapay Zekâ ile Toplu İçerik Yükleme
                  </h2>
                </div>
                <p className="mb-md font-body-sm text-body-sm text-on-surface-variant">
                  Word, PDF, Markdown veya metin dosyalarını yükleyin. Görselleri de
                  ekleyebilirsiniz. Yapay zekâ her içeriği ayrıştırıp alanlara
                  yerleştirecek ve yayın planı hazırlayacaktır.
                </p>

                <div className="mb-md">
                  <select
                    className="input-surface w-full rounded-lg px-4 py-2 font-body-md text-body-md"
                    disabled={sites.length === 0}
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                  >
                    {sites.length === 0 && <option value="">Bağlı site yok</option>}
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{" "}
                        {s.platform === "CUSTOM_SITE" ? "(Özel Site)" : "(WordPress)"}
                      </option>
                    ))}
                  </select>
                </div>

                <BulkUploadZone
                  files={aiFiles}
                  onChange={setAiFiles}
                  disabled={aiProcessing}
                />
              </section>

              <section className="panel-card p-md">
                <InstructionInput
                  value={aiInstruction}
                  onChange={setAiInstruction}
                  disabled={aiProcessing}
                />
              </section>

              {aiError && (
                <div className="rounded-xl border border-error/20 bg-error-container p-md text-on-error-container">
                  <p className="font-body-sm text-body-sm">{aiError}</p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  className="primary-button px-lg py-sm font-label-md text-label-md disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={aiFiles.length === 0 || !selectedSiteId}
                  onClick={handleAIProcess}
                >
                  <MaterialIcon name="auto_awesome" size={18} />
                  Yapay Zekâ ile İşle
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "manual" && <div className="space-y-md">
        {selectedSite ? (
          <section className="panel-card flex flex-wrap items-center justify-between gap-md p-md">
            <div className="min-w-0">
              <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                {selectedSite.platform === "CUSTOM_SITE"
                  ? "Aktif Özel Site"
                  : "Aktif WordPress Sitesi"}
              </p>
              <h1 className="truncate font-headline-sm text-headline-sm text-primary">
                {selectedSite.name}
              </h1>
              <p className="break-all font-body-sm text-body-sm text-on-surface-variant">
                {selectedSite.baseUrl}
                {selectedSite.platform === "WORDPRESS"
                  ? ` · ${(selectedSite as WordPressSite).username}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-sm">
              <StatusBadge tone={statusTone(selectedSite.connectionStatus)}>
                {selectedSite.connectionStatus}
              </StatusBadge>
              {selectedSite.lastError ? (
                <span className="max-w-md break-words font-body-sm text-body-sm text-error">
                  {selectedSite.lastError}
                </span>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-md text-amber-800">
            <div className="flex items-start gap-sm">
              <MaterialIcon name="warning" className="mt-0.5" />
              <p className="font-body-sm text-body-sm">
                Blog kartı oluşturmak için önce Hesap Bağlantıları ekranından en
                az bir WordPress veya Özel Site bağlanmalıdır.
              </p>
            </div>
          </section>
        )}

        {status ? (
          <section
            className={`rounded-xl border p-md ${
              status.tone === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : status.tone === "error"
                  ? "border-error/20 bg-error-container text-on-error-container"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            <p className="font-body-sm text-body-sm">{status.message}</p>
          </section>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-lg xl:grid-cols-12">
          <section className="space-y-md xl:col-span-8">
            <div className="panel-card p-md shadow-sm">
              <label className="mb-sm block font-label-md text-label-md text-on-surface-variant">
                Blog Başlığı
              </label>
              <input
                className="w-full border-none bg-transparent p-0 font-headline-md text-headline-md placeholder:text-outline-variant focus:ring-0"
                placeholder="Göz Alıcı Bir Başlık Girin..."
                type="text"
                value={title}
                onChange={(event) => handleTitleChange(event.target.value)}
              />
              <div className="flex min-w-0 flex-wrap items-center gap-xs pt-base">
                <MaterialIcon name="link" className="text-outline" size={16} />
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Slug:
                </span>
                <input
                  className="min-w-[220px] flex-1 border-none bg-transparent p-0 font-body-sm text-body-sm font-medium text-primary focus:ring-0"
                  value={slug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setSlug(createSlug(event.target.value));
                  }}
                />
                <button
                  className="ml-xs font-body-sm text-body-sm text-primary hover:underline"
                  type="button"
                  onClick={() => {
                    setSlugEdited(false);
                    setSlug(createSlug(title));
                  }}
                >
                  Otomatik Üret
                </button>
              </div>
            </div>

            <div className="panel-card flex min-h-[600px] flex-col overflow-hidden shadow-sm">
              <div className="flex flex-wrap gap-1 border-b border-outline-variant bg-surface-container-low p-2">
                {[
                  "format_bold",
                  "format_italic",
                  "format_underlined",
                  "format_list_bulleted",
                  "format_list_numbered",
                  "format_quote",
                  "link",
                  "image",
                  "code"
                ].map((icon, index) => (
                  <button
                    key={icon}
                    className={`rounded p-2 transition-colors hover:bg-surface-container-high ${
                      index === 3 || index === 5
                        ? "ml-2 border-l border-outline-variant"
                        : ""
                    }`}
                    type="button"
                    aria-label={icon}
                  >
                    <MaterialIcon name={icon} />
                  </button>
                ))}
              </div>
              <textarea
                className="min-h-[560px] flex-1 resize-none border-none bg-transparent p-md font-body-lg text-body-lg outline-none transition-colors placeholder:italic placeholder:text-outline-variant focus:bg-white focus:ring-0"
                placeholder="İçeriğinizi HTML veya düz metin olarak buraya yazmaya başlayın..."
                value={contentHtml}
                onChange={(event) => setContentHtml(event.target.value)}
              />
            </div>
          </section>

          <aside className="space-y-md xl:col-span-4">
            <section className="panel-card space-y-md p-md shadow-sm">
              <h2 className="font-headline-sm text-headline-sm">
                Yayınlama Ayarları
              </h2>
              <label className="space-y-sm">
                <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                  <MaterialIcon name="calendar_today" size={16} />
                  Yayınlanma Zamanı
                </span>
                <input
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </label>
              <div className="flex flex-col gap-sm pt-base">
                <button
                  className="primary-button w-full rounded-lg py-3 font-label-md text-label-md disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canSubmit}
                  type="button"
                  onClick={() => createBlogCard("publish_now")}
                >
                  <MaterialIcon name="rocket_launch" size={18} />
                  Hemen Yayınla
                </button>
                <div className="grid grid-cols-2 gap-sm">
                  <button
                    className="secondary-button py-2 font-label-sm text-label-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canSubmit}
                    type="button"
                    onClick={() => createBlogCard("draft")}
                  >
                    Taslak Kaydet
                  </button>
                  <button
                    className="secondary-button py-2 font-label-sm text-label-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canSubmit || !scheduledAt}
                    type="button"
                    onClick={() => createBlogCard("schedule")}
                  >
                    Planla
                  </button>
                </div>
              </div>
            </section>

            <section className="panel-card space-y-md p-md shadow-sm">
              <label className="space-y-sm">
                <span className="font-label-md text-label-md">
                  {selectedPlatform === "CUSTOM_SITE"
                    ? "Kategoriler"
                    : "Kategori ID'leri"}
                </span>
                <input
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  placeholder={
                    selectedPlatform === "CUSTOM_SITE"
                      ? "Örn: teknoloji, yazılım"
                      : "Örn: 3, 8"
                  }
                  type="text"
                  value={categoryIds}
                  onChange={(event) => setCategoryIds(event.target.value)}
                />
              </label>
              <label className="space-y-sm">
                <span className="font-label-md text-label-md">
                  {selectedPlatform === "CUSTOM_SITE"
                    ? "Etiketler"
                    : "Etiket ID'leri"}
                </span>
                <input
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  placeholder={
                    selectedPlatform === "CUSTOM_SITE"
                      ? "Örn: nextjs, react"
                      : "Örn: 12, 18"
                  }
                  type="text"
                  value={tagIds}
                  onChange={(event) => setTagIds(event.target.value)}
                />
              </label>
              <label className="space-y-sm">
                <span className="font-label-md text-label-md">Excerpt</span>
                <textarea
                  className="input-surface w-full resize-none rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  placeholder="Kısa içerik özeti..."
                  rows={3}
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.target.value)}
                />
              </label>
            </section>

            <section className="panel-card space-y-md p-md shadow-sm">
              <div className="flex items-center justify-between gap-sm">
                <h2 className="font-label-md text-label-md">
                  Öne Çıkan Görsel
                </h2>
                <button
                  className="secondary-button px-3 py-1.5 font-label-sm text-label-sm"
                  disabled={uploading}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Yükleniyor" : "Yükle"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFeaturedImageUpload}
              />
              <button
                className="relative flex h-48 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low transition-colors hover:bg-surface-container-high"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image
                  src={
                    featuredMedia
                      ? `/api/media/${featuredMedia.id}/file`
                      : featuredImage
                  }
                  alt=""
                  fill
                  unoptimized={Boolean(featuredMedia)}
                  loading="eager"
                  sizes="360px"
                  className={`object-cover ${featuredMedia ? "" : "opacity-20"}`}
                />
                {!featuredMedia ? (
                  <>
                    <MaterialIcon
                      name="add_photo_alternate"
                      className="relative z-10 mb-2 text-outline"
                      size={40}
                    />
                    <p className="relative z-10 font-body-sm text-body-sm text-on-surface-variant">
                      Görsel yükle veya sürükle
                    </p>
                  </>
                ) : null}
              </button>
            </section>

            <section className="panel-card space-y-md p-md shadow-sm">
              <h2 className="font-headline-sm text-headline-sm">
                SEO Ayarları
              </h2>
              <label className="space-y-sm">
                <span className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    SEO Başlığı
                  </span>
                  <span className="text-[10px] text-outline">
                    {seoTitle.length} / 60
                  </span>
                </span>
                <input
                  className="input-surface w-full rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  placeholder="Arama motoru başlığı..."
                  type="text"
                  value={seoTitle}
                  onChange={(event) => setSeoTitle(event.target.value)}
                />
              </label>
              <label className="space-y-sm">
                <span className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Meta Açıklama
                  </span>
                  <span
                    className={`text-[10px] ${
                      seoDescription.length > 160
                        ? "text-error"
                        : "text-outline"
                    }`}
                  >
                    {seoDescription.length} / 160
                  </span>
                </span>
                <textarea
                  className="input-surface w-full resize-none rounded-lg px-3 py-2 font-body-sm text-body-sm"
                  placeholder="İçerik özeti girin..."
                  rows={3}
                  value={seoDescription}
                  onChange={(event) => setSeoDescription(event.target.value)}
                />
              </label>
            </section>
          </aside>
        </div>
      </div>
      }
    </AppShell>
  );
}
