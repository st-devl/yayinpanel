"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { analyzeXText } from "@/lib/domain/x-text";
import {
  BulkUploadZone,
  type UploadedFile
} from "@/components/ai/bulk-upload-zone";
import { InstructionInput } from "@/components/ai/instruction-input";
import { ProcessingIndicator } from "@/components/ai/processing-indicator";

type XAccount = {
  id: string;
  accountName: string;
  username: string;
  xUserId: string;
  connectionStatus: string;
  lastError: string | null;
  profileImageUrl: string | null;
};

type MediaFile = {
  id: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  width: number | null;
  height: number | null;
};

type RequestState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const defaultSchedule = {
  frequency: "daily",
  skipWeekends: false,
  startDate: "",
  startTime: ""
};

function parsePostLines(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractFirstLink(value: string) {
  return value.match(/https?:\/\/[^\s]+/)?.[0] ?? "";
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(status: string) {
  if (status === "CONNECTED") return "success" as const;
  if (status === "RATE_LIMITED" || status === "NEEDS_RECONNECT") {
    return "warning" as const;
  }
  if (status === "DISCONNECTED") return "neutral" as const;
  return "error" as const;
}

export default function XPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");
  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // AI tab state
  const [aiFiles, setAiFiles] = useState<UploadedFile[]>([]);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRawText, setAiRawText] = useState("");
  const [text, setText] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [status, setStatus] = useState<RequestState>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      try {
        const response = await fetch("/api/accounts/x");
        const payload = (await response.json()) as { data?: XAccount[] };

        if (!response.ok) {
          throw new Error("X hesapları alınamadı.");
        }

        if (active) {
          const nextAccounts = payload.data ?? [];
          setAccounts(nextAccounts);
          setSelectedAccountId(
            nextAccounts.find(
              (account) => account.connectionStatus === "CONNECTED"
            )?.xUserId ??
              nextAccounts[0]?.xUserId ??
              ""
          );
        }
      } catch (error) {
        if (active) {
          setStatus({
            tone: "error",
            message:
              error instanceof Error ? error.message : "X hesapları alınamadı."
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAccounts();

    return () => {
      active = false;
    };
  }, []);

  const posts = useMemo(() => parsePostLines(text), [text]);
  const analyses = useMemo(() => posts.map(analyzeXText), [posts]);
  const invalidIndexes = analyses
    .map((analysis, index) => ({ analysis, index }))
    .filter(({ analysis }) => !analysis.valid || analysis.overBy > 0)
    .map(({ index }) => index);
  const firstPost = posts[0] ?? "";
  const firstAnalysis = analyzeXText(firstPost);
  const selectedAccount = accounts.find(
    (account) => account.xUserId === selectedAccountId
  );
  const hasLink = posts.some((post) => Boolean(extractFirstLink(post)));
  const canCreateDraft =
    Boolean(selectedAccountId) &&
    posts.length > 0 &&
    invalidIndexes.length === 0 &&
    !submitting;
  const canSchedule =
    canCreateDraft &&
    Boolean(schedule.startDate) &&
    Boolean(schedule.startTime);

  async function handleMediaUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const uploaded: MediaFile[] = [];

      for (const file of files.slice(0, 100)) {
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
          throw new Error(payload.error ?? `${file.name} yüklenemedi.`);
        }

        uploaded.push(payload.data);
      }

      setMediaFiles((current) => [...current, ...uploaded]);
      setStatus({
        tone: "success",
        message: `${uploaded.length} medya dosyası yüklendi. Dosyalar post sırasına göre eşleşti.`
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Medya yüklenemedi."
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function createCards(saveAsDraft: boolean) {
    if (!selectedAccountId) {
      setStatus({
        tone: "error",
        message: "Önce aktif bir X hesabı seçmelisiniz."
      });
      return;
    }

    if (posts.length === 0) {
      setStatus({ tone: "error", message: "En az bir post metni girin." });
      return;
    }

    if (invalidIndexes.length > 0) {
      setStatus({
        tone: "error",
        message:
          "Limit aşan veya geçersiz postlar düzeltilmeden kart oluşturulamaz."
      });
      return;
    }

    if (!saveAsDraft && (!schedule.startDate || !schedule.startTime)) {
      setStatus({
        tone: "error",
        message: "Planlama için başlangıç tarihi ve saat gerekli."
      });
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/content", {
        body: JSON.stringify({
          accountId: selectedAccountId,
          items: posts.map((post, index) => ({
            mediaFileId: mediaFiles[index]?.id,
            platformData: {
              hasMedia: Boolean(mediaFiles[index]?.id),
              isThread: false,
              linkUrl: extractFirstLink(post)
            },
            text: post
          })),
          platform: "X",
          saveAsDraft,
          schedule: saveAsDraft
            ? undefined
            : {
                frequency: schedule.frequency,
                skipWeekends: schedule.skipWeekends,
                startDate: schedule.startDate,
                startTime: schedule.startTime
              }
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        count?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Kart oluşturma başarısız.");
      }

      setStatus({
        tone: "success",
        message: saveAsDraft
          ? `${payload.count ?? posts.length} X kartı taslak olarak kaydedildi.`
          : `${payload.count ?? posts.length} X kartı planlandı.`
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Kart oluşturma başarısız."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="X / Twitter Paneli">
      <div className="space-y-lg">
        <section className="flex flex-col justify-between gap-md rounded-xl bg-white py-md lg:flex-row lg:items-center">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">
              X / Twitter Paneli
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Kısa postları satır satır hazırlayın, medya ile eşleştirin ve
              ortak içerik deposuna gönderin.
            </p>
          </div>
          <label className="relative block w-full max-w-sm">
            <span className="mb-xs block font-label-sm text-label-sm text-on-surface-variant">
              Aktif X Hesabı
            </span>
            <select
              className="input-surface block w-full appearance-none rounded-lg px-md py-sm font-body-md text-body-md"
              disabled={loading || accounts.length === 0}
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              {accounts.length === 0 ? (
                <option value="">
                  {loading ? "Hesaplar yükleniyor..." : "Bağlı X hesabı yok"}
                </option>
              ) : null}
              {accounts.map((account) => (
                <option key={account.id} value={account.xUserId}>
                  @{account.username} - {account.accountName}
                </option>
              ))}
            </select>
            <MaterialIcon
              name="expand_more"
              className="pointer-events-none absolute right-3 top-9 text-on-surface-variant"
            />
          </label>
        </section>

        {/* Tab bar */}
        <div className="flex gap-xs rounded-xl border border-outline-variant bg-surface-container-low p-xs">
          {(["manual", "ai"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`flex flex-1 items-center justify-center gap-xs rounded-lg px-md py-sm font-label-md text-label-md transition-colors ${
                activeTab === tab
                  ? "bg-surface text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              <MaterialIcon
                name={tab === "manual" ? "edit" : "auto_awesome"}
                size={18}
              />
              {tab === "manual" ? "Manuel" : "AI ile Toplu Yükle"}
            </button>
          ))}
        </div>

        {/* AI Tab */}
        {activeTab === "ai" && (
          <div className="space-y-md">
            {aiProcessing ? (
              <ProcessingIndicator
                fileCount={aiFiles.length + (aiRawText ? 1 : 0)}
              />
            ) : (
              <>
                <section className="panel-card space-y-md p-md">
                  <div className="flex items-center gap-sm">
                    <MaterialIcon
                      name="auto_awesome"
                      className="text-primary"
                    />
                    <h2 className="font-headline-sm text-headline-sm">
                      AI ile Toplu X Gönderisi Yükleme
                    </h2>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Metinleri aşağıya yapıştırın veya dosya yükleyin. AI her
                    gönderiyi ayrıştırıp thread/tek gönderi olarak
                    yapılandıracaktır.
                  </p>
                  <label className="block space-y-xs">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Gönderi metinleri (yapıştır)
                    </span>
                    <textarea
                      className="input-surface w-full resize-y rounded-lg px-3 py-2 font-body-sm text-body-sm"
                      rows={6}
                      placeholder="Birden fazla gönderi varsa aralarına --- koyabilirsiniz..."
                      value={aiRawText}
                      onChange={(e) => setAiRawText(e.target.value)}
                    />
                  </label>
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
                    disabled={
                      (!aiRawText.trim() && aiFiles.length === 0) ||
                      !selectedAccountId
                    }
                    onClick={async () => {
                      if (!selectedAccountId) {
                        setAiError("Hesap seçin.");
                        return;
                      }
                      setAiProcessing(true);
                      setAiError(null);
                      try {
                        const uploadedMediaIds: string[] = [];
                        const uploadedDocIds: string[] = [];
                        for (const f of aiFiles) {
                          const fd = new FormData();
                          fd.append("file", f.file);
                          const r = await fetch("/api/media", {
                            method: "POST",
                            body: fd
                          });
                          const p = (await r.json()) as {
                            data?: { id: string };
                            error?: string;
                          };
                          if (!r.ok || !p.data)
                            throw new Error(
                              p.error ?? `${f.file.name} yüklenemedi.`
                            );
                          if (f.type === "image")
                            uploadedMediaIds.push(p.data.id);
                          else uploadedDocIds.push(p.data.id);
                        }
                        const res = await fetch("/api/ai/process", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            platform: "X",
                            accountId: selectedAccountId,
                            mediaFileIds: uploadedMediaIds,
                            documentFileIds: uploadedDocIds,
                            rawText: aiRawText || undefined,
                            instructionText: aiInstruction
                          })
                        });
                        const payload = (await res.json()) as {
                          data?: { batchId: string };
                          error?: string;
                        };
                        if (!res.ok || !payload.data)
                          throw new Error(payload.error ?? "İşleme başarısız.");
                        router.push(`/review/${payload.data.batchId}`);
                      } catch (err) {
                        setAiError(
                          err instanceof Error ? err.message : "Hata."
                        );
                        setAiProcessing(false);
                      }
                    }}
                  >
                    <MaterialIcon name="auto_awesome" size={18} />
                    Yapay Zekâ ile İşle
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "manual" && selectedAccount ? (
          <section className="panel-card flex flex-wrap items-center justify-between gap-md p-md">
            <div className="flex min-w-0 items-center gap-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container">
                {selectedAccount.profileImageUrl ? (
                  <Image
                    src={selectedAccount.profileImageUrl}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <MaterialIcon name="share" className="text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-label-md text-label-md font-bold">
                  @{selectedAccount.username}
                </p>
                <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                  {selectedAccount.accountName}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-sm">
              <StatusBadge tone={statusTone(selectedAccount.connectionStatus)}>
                {selectedAccount.connectionStatus}
              </StatusBadge>
              {selectedAccount.lastError ? (
                <span className="max-w-md break-words font-body-sm text-body-sm text-error">
                  {selectedAccount.lastError}
                </span>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-md text-amber-800">
            <div className="flex items-start gap-sm">
              <MaterialIcon name="warning" className="mt-0.5" />
              <p className="font-body-sm text-body-sm">
                X panelinde kart oluşturmak için önce Hesap Bağlantıları
                ekranından en az bir X hesabı bağlanmalıdır.
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

        <section className="grid grid-cols-12 gap-md">
          <div className="col-span-12 space-y-md lg:col-span-8">
            <section className="panel-card p-md">
              <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
                <label
                  className="font-label-md text-label-md uppercase text-on-surface-variant"
                  htmlFor="tweetText"
                >
                  Toplu Post Metni Girişi
                </label>
                <div className="flex items-center gap-xs text-on-surface-variant">
                  <MaterialIcon name="info" size={18} />
                  <span className="font-label-sm text-label-sm">
                    Her dolu satır ayrı X kartı olur.
                  </span>
                </div>
              </div>

              <textarea
                id="tweetText"
                className={`w-full resize-none rounded-lg border p-md font-body-md transition-all focus:ring-2 focus:ring-primary/10 ${
                  invalidIndexes.length > 0
                    ? "border-error bg-error-container/10"
                    : "border-outline-variant bg-white"
                }`}
                placeholder={
                  "Kurban bağış süreci başladı...\nYeni blog yazımız yayında: https://example.com"
                }
                rows={8}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />

              <div className="mt-sm flex flex-wrap items-center justify-between gap-md">
                <div className="flex flex-wrap items-center gap-md">
                  <div className="flex items-center gap-xs">
                    <span
                      className={`font-headline-sm text-headline-sm ${
                        firstAnalysis.overBy > 0 ? "text-error" : "text-primary"
                      }`}
                    >
                      {firstAnalysis.weightedLength}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      / 280
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-xs ${
                      hasLink ? "text-green-700" : "text-on-surface-variant"
                    }`}
                  >
                    <MaterialIcon
                      name={hasLink ? "link" : "link_off"}
                      size={20}
                    />
                    <span className="font-label-md text-label-md">
                      Link Kontrolü: {hasLink ? "Geçerli" : "Pasif"}
                    </span>
                  </div>
                  <StatusBadge
                    tone={invalidIndexes.length > 0 ? "error" : "neutral"}
                  >
                    {posts.length} post
                  </StatusBadge>
                </div>

                <div className="flex flex-wrap gap-sm">
                  {invalidIndexes.length > 0 ? (
                    <span className="font-label-sm text-label-sm text-error">
                      {invalidIndexes.length} post limit dışı
                    </span>
                  ) : null}
                  <button
                    className="flex items-center gap-xs rounded-lg p-2 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container"
                    type="button"
                  >
                    <MaterialIcon name="auto_awesome" />
                    AI İyileştir
                  </button>
                  <button
                    className="flex items-center gap-xs rounded-lg p-2 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container"
                    type="button"
                  >
                    <MaterialIcon name="tag" />
                    Hashtag Bul
                  </button>
                </div>
              </div>
            </section>

            <section className="panel-card p-md">
              <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
                <h2 className="font-label-md text-label-md uppercase text-on-surface-variant">
                  Opsiyonel Medya Eşleştirme
                </h2>
                <button
                  className="secondary-button px-4 py-2 font-label-sm text-label-sm"
                  disabled={uploading}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <MaterialIcon name="upload" size={18} />
                  {uploading ? "Yükleniyor" : "Medya Yükle"}
                </button>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleMediaUpload}
                />
              </div>

              <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
                <button
                  className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant transition-colors hover:bg-surface-container-low"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <MaterialIcon
                    name="add_a_photo"
                    className="text-on-surface-variant"
                    size={34}
                  />
                  <span className="mt-xs font-label-sm text-label-sm text-on-surface-variant">
                    Medya Ekle
                  </span>
                </button>
                {mediaFiles.slice(0, 7).map((media) => (
                  <div
                    key={media.id}
                    className="relative aspect-square overflow-hidden rounded-xl border border-outline-variant bg-surface-container"
                    title={media.originalFileName}
                  >
                    <Image
                      src={`/api/media/${media.id}/file`}
                      alt={media.originalFileName}
                      fill
                      unoptimized
                      sizes="160px"
                      className="object-cover"
                    />
                    <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/60 px-1.5 py-1 text-[10px] font-semibold text-white">
                      {formatBytes(media.fileSize)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-sm text-[11px] text-on-surface-variant">
                Görseller post sırasına göre eşleşir. X için bu MVP akışında her
                post en fazla bir medya dosyası alır.
              </p>
            </section>

            <section className="panel-card p-md">
              <h2 className="mb-md font-label-md text-label-md uppercase text-on-surface-variant">
                Planlama Ayarları
              </h2>
              <div className="flex flex-wrap gap-md">
                <label className="min-w-[180px] flex-1">
                  <span className="mb-xs block font-label-sm text-label-sm text-on-surface-variant">
                    Başlangıç Tarihi
                  </span>
                  <input
                    className="input-surface w-full rounded-lg px-md py-sm"
                    type="date"
                    value={schedule.startDate}
                    onChange={(event) =>
                      setSchedule((current) => ({
                        ...current,
                        startDate: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="min-w-[160px] flex-1">
                  <span className="mb-xs block font-label-sm text-label-sm text-on-surface-variant">
                    Saat
                  </span>
                  <input
                    className="input-surface w-full rounded-lg px-md py-sm"
                    type="time"
                    value={schedule.startTime}
                    onChange={(event) =>
                      setSchedule((current) => ({
                        ...current,
                        startTime: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="min-w-[180px] flex-1">
                  <span className="mb-xs block font-label-sm text-label-sm text-on-surface-variant">
                    Aralık
                  </span>
                  <select
                    className="input-surface w-full rounded-lg px-md py-sm"
                    value={schedule.frequency}
                    onChange={(event) =>
                      setSchedule((current) => ({
                        ...current,
                        frequency: event.target.value
                      }))
                    }
                  >
                    <option value="daily">Her gün</option>
                    <option value="every_two_days">2 günde bir</option>
                    <option value="weekly">Haftalık</option>
                  </select>
                </label>
                <label className="flex min-w-[180px] flex-1 items-end gap-sm pb-2 font-label-md text-label-md text-on-surface-variant">
                  <input
                    className="rounded border-outline-variant text-primary focus:ring-primary/20"
                    type="checkbox"
                    checked={schedule.skipWeekends}
                    onChange={(event) =>
                      setSchedule((current) => ({
                        ...current,
                        skipWeekends: event.target.checked
                      }))
                    }
                  />
                  Hafta sonlarını atla
                </label>
              </div>
            </section>
          </div>

          <aside className="col-span-12 space-y-md lg:col-span-4">
            <section className="panel-card sticky top-[104px] p-md">
              <div className="mb-md flex items-center justify-between">
                <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
                  Kart Oluşturma Önizlemesi
                </h2>
                <span className="rounded bg-surface-container-highest px-2 py-1 text-[10px] font-bold">
                  LIVE
                </span>
              </div>

              <div className="rounded-xl border border-outline-variant bg-white p-md">
                <div className="flex gap-sm">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container">
                    {selectedAccount?.profileImageUrl ? (
                      <Image
                        src={selectedAccount.profileImageUrl}
                        alt=""
                        width={48}
                        height={48}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-xs">
                      <span className="truncate font-bold">
                        {selectedAccount?.accountName ?? "X Hesabı"}
                      </span>
                      <MaterialIcon
                        name="verified"
                        className="text-primary"
                        fill
                        size={14}
                      />
                      <span className="truncate text-body-sm text-on-surface-variant">
                        @{selectedAccount?.username ?? "hesap_sec"}
                      </span>
                      <span className="text-body-sm text-on-surface-variant">
                        · 1sn
                      </span>
                    </div>
                    <p className="mt-xs break-words font-body-md text-body-md">
                      {firstPost || "İlk post önizlemesi burada görünecek..."}
                    </p>
                    {mediaFiles[0] ? (
                      <div className="mt-md overflow-hidden rounded-2xl border border-outline-variant">
                        <Image
                          src={`/api/media/${mediaFiles[0].id}/file`}
                          alt={mediaFiles[0].originalFileName}
                          width={640}
                          height={360}
                          unoptimized
                          className="h-auto w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="mt-md flex max-w-xs justify-between text-on-surface-variant">
                      {[
                        "chat_bubble",
                        "repeat",
                        "favorite",
                        "bar_chart",
                        "share"
                      ].map((icon) => (
                        <MaterialIcon key={icon} name={icon} size={18} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-lg space-y-sm">
                <button
                  className="primary-button w-full rounded-xl py-4 font-headline-sm text-headline-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canCreateDraft}
                  type="button"
                  onClick={() => createCards(true)}
                >
                  <MaterialIcon name="draft" />
                  Taslak Kart Oluştur
                </button>
                <button
                  className="secondary-button w-full rounded-xl py-3 font-label-md text-label-md disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canSchedule}
                  type="button"
                  onClick={() => createCards(false)}
                >
                  <MaterialIcon name="schedule_send" />
                  Toplu Planla
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-outline-variant bg-surface-container-low p-md">
              <div className="mb-xs flex items-center gap-sm">
                <MaterialIcon name="fact_check" className="text-primary" />
                <h2 className="font-label-md text-label-md uppercase tracking-wider">
                  Eşleştirme Özeti
                </h2>
              </div>
              <div className="space-y-xs font-body-sm text-body-sm text-on-surface-variant">
                {posts.length === 0 ? (
                  <p>Post metni girildiğinde eşleştirme listesi oluşur.</p>
                ) : (
                  posts.slice(0, 6).map((post, index) => {
                    const analysis = analyses[index];
                    const media = mediaFiles[index];

                    return (
                      <div
                        key={`${post}-${index}`}
                        className="flex items-start justify-between gap-sm rounded-lg bg-white px-sm py-xs"
                      >
                        <span className="line-clamp-2 min-w-0 flex-1">
                          {index + 1}. {post}
                        </span>
                        <span
                          className={
                            analysis.overBy > 0 ? "text-error" : "text-primary"
                          }
                        >
                          {analysis.weightedLength}/280
                        </span>
                        <MaterialIcon
                          name={media ? "image" : "image_not_supported"}
                          className={
                            media ? "text-primary" : "text-on-surface-variant"
                          }
                          size={16}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
