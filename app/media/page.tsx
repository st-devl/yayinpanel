"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { readJsonResponse } from "@/lib/client/http";

type ViewMode = "grid" | "list";

type MediaFile = {
  id: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
  usedByContentCards: number;
};

type RequestState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const initialTake = 24;

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeZone: "Europe/Istanbul"
  }).format(new Date(value));
}

function dimensions(media: MediaFile) {
  if (!media.width || !media.height) {
    return "Boyut okunamadı";
  }

  return `${media.width} × ${media.height}`;
}

function mediaStatus(media: MediaFile) {
  if (media.usedByContentCards > 0) {
    return {
      label: `${media.usedByContentCards} içerikte`,
      tone: "success" as const
    };
  }

  return { label: "Boşta", tone: "neutral" as const };
}

export default function MediaPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [take, setTake] = useState(initialTake);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>(null);

  const hasActiveSearch = query.trim().length > 0;
  const visibleCount = mediaFiles.length;
  const canLoadMore = visibleCount >= take;
  const summary = useMemo(() => {
    const used = mediaFiles.filter((media) => media.usedByContentCards > 0);
    const totalBytes = mediaFiles.reduce(
      (sum, media) => sum + media.fileSize,
      0
    );

    return {
      available: mediaFiles.length - used.length,
      totalSize: formatFileSize(totalBytes),
      used: used.length
    };
  }, [mediaFiles]);

  useEffect(() => {
    let active = true;

    async function loadMedia() {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          mimeType: "image/",
          take: String(take)
        });
        const trimmedQuery = query.trim();

        if (trimmedQuery) {
          params.set("q", trimmedQuery);
        }

        const response = await fetch(`/api/media?${params.toString()}`);
        if (!active) return;

        const payload = await readJsonResponse<{
          data?: MediaFile[];
          error?: string;
        }>(response);
        if (!active) return;

        if (!response.ok) {
          throw new Error(payload.error ?? "Medya dosyaları alınamadı.");
        }

        setMediaFiles(payload.data ?? []);
      } catch (error) {
        if (!active) return;
        setRequestState({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Medya dosyaları alınamadı."
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMedia().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [query, take]);

  async function refreshMedia() {
    const params = new URLSearchParams({
      mimeType: "image/",
      take: String(take)
    });
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }

    const response = await fetch(`/api/media?${params.toString()}`);
    const payload = await readJsonResponse<{
      data?: MediaFile[];
      error?: string;
    }>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? "Medya dosyaları yenilenemedi.");
    }

    setMediaFiles(payload.data ?? []);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.type.startsWith("video/")) {
      setRequestState({
        tone: "info",
        message:
          "Video yükleme MVP kapsamı dışında. Şimdilik JPG, PNG veya WEBP görsel yükleyin."
      });
      return;
    }

    if (!allowedImageTypes.has(file.type)) {
      setRequestState({
        tone: "error",
        message: "Yalnızca JPG, PNG ve WEBP görseller desteklenir."
      });
      return;
    }

    setUploading(true);
    setRequestState(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/media", {
        body: formData,
        method: "POST"
      });
      const payload = await readJsonResponse<{
        data?: MediaFile;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Medya yüklenemedi.");
      }

      setRequestState({
        tone: "success",
        message: `${payload.data?.originalFileName ?? file.name} yüklendi.`
      });
      await refreshMedia();
    } catch (error) {
      setRequestState({
        tone: "error",
        message: error instanceof Error ? error.message : "Medya yüklenemedi."
      });
    } finally {
      setUploading(false);
    }
  }

  async function deleteMedia(media: MediaFile) {
    if (media.usedByContentCards > 0) {
      setRequestState({
        tone: "info",
        message: "Bu medya içerik kartlarında kullanıldığı için silinemez."
      });
      return;
    }

    if (!window.confirm(`${media.originalFileName} silinsin mi?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/media/${media.id}`, {
        method: "DELETE"
      });
      const payload = await readJsonResponse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Medya silinemedi.");
      }

      setRequestState({ tone: "success", message: "Medya dosyası silindi." });
      await refreshMedia();
    } catch (error) {
      setRequestState({
        tone: "error",
        message: error instanceof Error ? error.message : "Medya silinemedi."
      });
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setTake(initialTake);
  }

  const uploadButton = (
    <button
      className="primary-button ml-auto hidden rounded-xl px-6 py-2.5 font-label-md text-label-md shadow-sm disabled:cursor-not-allowed disabled:opacity-60 lg:inline-flex"
      disabled={uploading}
      type="button"
      onClick={openFilePicker}
    >
      <MaterialIcon name={uploading ? "progress_activity" : "upload"} />
      {uploading ? "Yükleniyor" : "Medya Yükle"}
    </button>
  );

  return (
    <AppShell
      title="Medya Kütüphanesi"
      searchPlaceholder="Medya dosyalarında ara..."
      topbarSlot={uploadButton}
    >
      <input
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,video/*"
        type="file"
        onChange={handleUpload}
      />

      <div className="space-y-lg">
        <section className="flex flex-col justify-between gap-md md:flex-row md:items-center">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">
              Medya Kütüphanesi
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Tüm dijital varlıklarınızı buradan yönetin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-base rounded-xl border border-outline-variant bg-surface-container-low p-1">
            <button
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-label-md transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
              type="button"
              onClick={() => setViewMode("grid")}
            >
              <MaterialIcon name="grid_view" size={20} />
              Galeri
            </button>
            <button
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-label-md transition-colors ${
                viewMode === "list"
                  ? "bg-white text-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
              type="button"
              onClick={() => setViewMode("list")}
            >
              <MaterialIcon name="list" size={20} />
              Liste
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-md md:grid-cols-3">
          <div className="panel-card p-md">
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Toplam Görsel
            </p>
            <p className="mt-xs font-headline-md text-headline-md text-primary">
              {visibleCount}
            </p>
          </div>
          <div className="panel-card p-md">
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Kullanımda
            </p>
            <p className="mt-xs font-headline-md text-headline-md text-primary">
              {summary.used}
            </p>
          </div>
          <div className="panel-card p-md">
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Toplam Boyut
            </p>
            <p className="mt-xs font-headline-md text-headline-md text-primary">
              {summary.totalSize}
            </p>
          </div>
        </section>

        <section className="panel-card flex flex-col gap-md p-md">
          <div className="flex flex-col gap-md lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <MaterialIcon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
                size={20}
              />
              <input
                className="input-surface w-full rounded-lg py-2.5 pl-10 pr-4 font-body-sm text-body-sm"
                placeholder="Dosya adıyla ara"
                type="search"
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap gap-sm">
              <button
                className="primary-button px-md py-2.5 font-label-md text-label-md disabled:cursor-not-allowed disabled:opacity-60 lg:hidden"
                disabled={uploading}
                type="button"
                onClick={openFilePicker}
              >
                <MaterialIcon
                  name={uploading ? "progress_activity" : "upload"}
                />
                {uploading ? "Yükleniyor" : "Medya Yükle"}
              </button>
              <button
                className="secondary-button px-md py-2.5 font-label-md text-label-md"
                type="button"
                onClick={() => {
                  handleQueryChange("");
                  setRequestState(null);
                }}
              >
                <MaterialIcon name="filter_alt_off" size={18} />
                Temizle
              </button>
              <button
                className="secondary-button cursor-not-allowed px-md py-2.5 font-label-md text-label-md opacity-60"
                disabled
                type="button"
                title="Video yükleme MVP kapsamı dışında"
              >
                <MaterialIcon name="videocam_off" size={18} />
                Video Pasif
              </button>
            </div>
          </div>

          <p className="font-body-sm text-body-sm text-on-surface-variant">
            JPG, PNG ve WEBP görseller desteklenir. Görsel dosyaları 20 MB
            sınırını aşmamalıdır; videolar MVP kapsamında yüklenmez.
          </p>
        </section>

        {requestState ? (
          <section
            className={`rounded-xl border p-md ${
              requestState.tone === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : requestState.tone === "error"
                  ? "border-error/20 bg-error-container text-on-error-container"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            <p className="font-body-sm text-body-sm">{requestState.message}</p>
          </section>
        ) : null}

        {loading ? (
          <section className="panel-card p-xl text-center font-body-md text-body-md text-on-surface-variant">
            Medya dosyaları yükleniyor...
          </section>
        ) : null}

        {!loading && mediaFiles.length === 0 ? (
          <section className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-xl text-center">
            <div className="mb-md flex h-28 w-28 items-center justify-center rounded-full bg-surface-container-highest">
              <MaterialIcon
                name="cloud_off"
                className="text-outline"
                size={56}
              />
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {hasActiveSearch
                ? "Aramaya uygun medya bulunamadı"
                : "Henüz medya dosyası yüklenmedi"}
            </h2>
            <p className="mt-xs max-w-md font-body-md text-body-md text-on-surface-variant">
              {hasActiveSearch
                ? "Arama terimini temizleyerek tüm medya dosyalarını tekrar görüntüleyebilirsiniz."
                : "İçeriklerinizi zenginleştirmek için ilk görsel dosyanızı yükleyin."}
            </p>
            <button
              className="primary-button mt-md px-lg py-3 font-label-md text-label-md"
              type="button"
              onClick={
                hasActiveSearch ? () => handleQueryChange("") : openFilePicker
              }
            >
              <MaterialIcon name={hasActiveSearch ? "filter_alt_off" : "add"} />
              {hasActiveSearch ? "Aramayı Temizle" : "İlk Dosyayı Yükle"}
            </button>
          </section>
        ) : null}

        {!loading && mediaFiles.length > 0 && viewMode === "grid" ? (
          <section className="grid grid-cols-1 gap-md sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {mediaFiles.map((media, index) => {
              const status = mediaStatus(media);
              const isUsed = media.usedByContentCards > 0;

              return (
                <article
                  key={media.id}
                  className="group relative overflow-hidden rounded-xl border border-outline-variant bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-panel-sm"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container">
                    <Image
                      src={`/api/media/${media.id}/file`}
                      alt={media.originalFileName}
                      fill
                      unoptimized
                      loading={index === 0 ? "eager" : "lazy"}
                      sizes="(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-2 top-2">
                      <StatusBadge tone={status.tone}>
                        {status.label}
                      </StatusBadge>
                    </div>
                    <div className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-[10px] font-bold uppercase text-on-surface shadow-sm backdrop-blur-sm">
                      {media.mimeType.replace("image/", "")}
                    </div>
                  </div>

                  <div className="p-4">
                    <h2
                      className="mb-1 truncate font-label-md text-label-md text-on-surface"
                      title={media.originalFileName}
                    >
                      {media.originalFileName}
                    </h2>
                    <p className="mb-base truncate font-label-sm text-label-sm text-on-surface-variant">
                      {formatFileSize(media.fileSize)} •{" "}
                      {formatDate(media.createdAt)}
                    </p>
                    <div className="flex items-center justify-between gap-sm">
                      <span className="truncate font-label-sm text-label-sm text-on-surface-variant">
                        {dimensions(media)}
                      </span>
                      <button
                        className="rounded p-1 text-error transition-colors hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isUsed}
                        type="button"
                        title={
                          isUsed
                            ? "Kullanımdaki medya silinemez"
                            : "Medya dosyasını sil"
                        }
                        aria-label={`${media.originalFileName} sil`}
                        onClick={() => deleteMedia(media)}
                      >
                        <MaterialIcon name="delete" size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {!loading && mediaFiles.length > 0 && viewMode === "list" ? (
          <section className="panel-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="bg-surface-container-low text-left">
                  <tr className="border-b border-outline-variant">
                    <th className="px-md py-sm font-label-sm text-label-sm uppercase text-on-surface-variant">
                      Dosya
                    </th>
                    <th className="px-md py-sm font-label-sm text-label-sm uppercase text-on-surface-variant">
                      Tür
                    </th>
                    <th className="px-md py-sm font-label-sm text-label-sm uppercase text-on-surface-variant">
                      Boyut
                    </th>
                    <th className="px-md py-sm font-label-sm text-label-sm uppercase text-on-surface-variant">
                      Kullanım
                    </th>
                    <th className="px-md py-sm font-label-sm text-label-sm uppercase text-on-surface-variant">
                      Tarih
                    </th>
                    <th className="px-md py-sm text-right font-label-sm text-label-sm uppercase text-on-surface-variant">
                      Aksiyon
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mediaFiles.map((media) => {
                    const status = mediaStatus(media);
                    const isUsed = media.usedByContentCards > 0;

                    return (
                      <tr
                        key={media.id}
                        className="border-b border-outline-variant last:border-b-0"
                      >
                        <td className="px-md py-sm">
                          <div className="flex min-w-0 items-center gap-sm">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-container">
                              <Image
                                src={`/api/media/${media.id}/file`}
                                alt={media.originalFileName}
                                fill
                                unoptimized
                                sizes="48px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p
                                className="truncate font-label-md text-label-md text-on-surface"
                                title={media.originalFileName}
                              >
                                {media.originalFileName}
                              </p>
                              <p className="font-label-sm text-label-sm text-on-surface-variant">
                                {dimensions(media)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-md py-sm font-body-sm text-body-sm text-on-surface-variant">
                          {media.mimeType}
                        </td>
                        <td className="px-md py-sm font-body-sm text-body-sm text-on-surface-variant">
                          {formatFileSize(media.fileSize)}
                        </td>
                        <td className="px-md py-sm">
                          <StatusBadge tone={status.tone}>
                            {status.label}
                          </StatusBadge>
                        </td>
                        <td className="px-md py-sm font-body-sm text-body-sm text-on-surface-variant">
                          {formatDate(media.createdAt)}
                        </td>
                        <td className="px-md py-sm text-right">
                          <button
                            className="rounded p-2 text-error transition-colors hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={isUsed}
                            type="button"
                            title={
                              isUsed
                                ? "Kullanımdaki medya silinemez"
                                : "Medya dosyasını sil"
                            }
                            aria-label={`${media.originalFileName} sil`}
                            onClick={() => deleteMedia(media)}
                          >
                            <MaterialIcon name="delete" size={18} />
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

        {!loading && mediaFiles.length > 0 && canLoadMore ? (
          <div className="flex justify-center pt-md">
            <button
              className="secondary-button rounded-xl px-8 py-3 font-label-md text-label-md"
              type="button"
              onClick={() => setTake((value) => value + initialTake)}
            >
              Daha Fazla Yükle
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
