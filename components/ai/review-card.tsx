"use client";

import { useState } from "react";
import Image from "next/image";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  CONFIDENCE_COLORS,
  CONFIDENCE_LABELS,
  classifyConfidence
} from "@/lib/ai/confidence-classifier";

export type ReviewItemData = {
  id: string;
  platform: string;
  accountId: string;
  contentType: string | null;
  proposedPlatformData: string;
  mediaAssignments: string;
  scheduledAt: string | null;
  confidence: number;
  warnings: string;
  reviewStatus: string;
  aiNotes: string | null;
};

type MediaAssignment = {
  fileId: string;
  role: string;
  altText?: string;
  order?: number;
};

type ReviewCardProps = {
  item: ReviewItemData;
  selected: boolean;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (item: ReviewItemData) => void;
  busy: boolean;
};

const REVIEW_STATUS_TONES: Record<
  string,
  "success" | "error" | "warning" | "neutral"
> = {
  READY: "neutral",
  EDITED: "warning",
  APPROVED: "success",
  REJECTED: "error",
  PENDING: "neutral",
  ERROR: "error"
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  READY: "Hazır",
  EDITED: "Düzenlendi",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  PENDING: "Bekliyor",
  ERROR: "Hata"
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog yazısı",
  news: "Haber",
  announcement: "Duyuru",
  instagram_post: "Instagram gönderisi",
  instagram_carousel: "Instagram carousel",
  x_post: "X gönderisi",
  x_thread: "X seri gönderi",
  campaign: "Kampanya",
  product: "Ürün"
};

export function ReviewCard({
  item,
  selected,
  onSelect,
  onApprove,
  onReject,
  onEdit,
  busy
}: ReviewCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const confidenceLevel = classifyConfidence(item.confidence);
  const confidenceStyle = CONFIDENCE_COLORS[confidenceLevel];
  const warnings = parseJsonArray(item.warnings);
  const platformData = parseJsonObj(item.proposedPlatformData);
  const mediaAssignments = parseMediaAssignments(item.mediaAssignments);
  const title = extractTitle(platformData, item.contentType);
  const body = extractBody(platformData);
  const firstMedia = mediaAssignments[0];
  const isApproved = item.reviewStatus === "APPROVED";
  const isRejected = item.reviewStatus === "REJECTED";
  const statusTone = REVIEW_STATUS_TONES[item.reviewStatus] ?? "neutral";

  return (
    <article
      className={`panel-card flex flex-col overflow-hidden transition-shadow hover:shadow-panel-sm ${
        selected ? "ring-2 ring-primary" : ""
      } ${isApproved ? "opacity-70" : ""}`}
    >
      {firstMedia ? (
        <div className="relative h-40 overflow-hidden bg-surface-container-low">
          <Image
            src={`/api/media/${firstMedia.fileId}/file`}
            alt={firstMedia.altText ?? "İçerik görseli"}
            fill
            unoptimized
            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
            loading="lazy"
          />
          {mediaAssignments.length > 1 ? (
            <span className="absolute bottom-sm right-sm rounded-md bg-white/90 px-xs py-0.5 font-label-sm text-label-sm text-on-surface shadow-sm">
              {mediaAssignments.length} görsel
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-sm p-md">
        <div className="flex items-start gap-sm">
          <input
            type="checkbox"
            className="mt-1 shrink-0"
            checked={selected}
            onChange={() => onSelect(item.id)}
            disabled={isApproved || isRejected}
            aria-label="İçeriği seç"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-xs flex items-center justify-between gap-sm">
              <StatusBadge tone={statusTone}>
                {REVIEW_STATUS_LABELS[item.reviewStatus] ?? item.reviewStatus}
              </StatusBadge>
              {item.scheduledAt ? (
                <span className="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant">
                  <MaterialIcon name="schedule" size={14} />
                  {formatDate(item.scheduledAt)}
                </span>
              ) : (
                <span className="flex items-center gap-xs font-body-sm text-body-sm text-amber-600">
                  <MaterialIcon name="warning" size={14} />
                  Tarih belirsiz
                </span>
              )}
            </div>

            <h3 className="line-clamp-2 font-headline-sm text-headline-sm">
              {title || "(Başlık yok)"}
            </h3>
          </div>
        </div>

        {body ? (
          <p className="line-clamp-4 whitespace-pre-line font-body-sm text-body-sm text-on-surface-variant">
            {body}
          </p>
        ) : (
          <p className="font-body-sm text-body-sm text-amber-700">
            İçerik metni bulunamadı. Onaylamadan önce Düzenle ile metin girin.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-sm">
          <span
            className={`rounded-md border px-xs py-0.5 font-label-sm text-label-sm ${confidenceStyle.bg} ${confidenceStyle.text} ${confidenceStyle.border}`}
          >
            {CONFIDENCE_LABELS[confidenceLevel]} (
            {Math.round(item.confidence * 100)}%)
          </span>

          {warnings.length > 0 ? (
            <span className="flex items-center gap-xs font-body-sm text-body-sm text-amber-600">
              <MaterialIcon name="warning" size={14} />
              {warnings.length} uyarı
            </span>
          ) : null}
        </div>

        {warnings.length > 0 ? (
          <ul className="space-y-xs">
            {warnings.map((warning) => (
              <li
                key={warning}
                className="rounded-lg border border-amber-200 bg-amber-50 px-sm py-xs font-body-sm text-body-sm text-amber-800"
              >
                {warningLabel(warning)}
              </li>
            ))}
          </ul>
        ) : null}

        {detailsOpen ? (
          <div className="space-y-sm border-t border-outline-variant pt-sm">
            <DetailRow
              label="İçerik türü"
              value={
                item.contentType
                  ? (CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType)
                  : "-"
              }
            />
            <DetailRow
              label="Yayın tarihi"
              value={item.scheduledAt ? formatDate(item.scheduledAt) : "-"}
            />
            {body ? (
              <div>
                <p className="mb-xs font-label-sm text-label-sm text-on-surface-variant">
                  İçerik
                </p>
                <p className="whitespace-pre-line rounded-lg border border-outline-variant bg-surface-container-low p-sm font-body-sm text-body-sm">
                  {body}
                </p>
              </div>
            ) : null}
            {mediaAssignments.length > 0 ? (
              <div>
                <p className="mb-xs font-label-sm text-label-sm text-on-surface-variant">
                  Görseller
                </p>
                <div className="grid grid-cols-2 gap-sm">
                  {mediaAssignments.map((media) => (
                    <div
                      key={`${media.fileId}-${media.role}-${media.order ?? 0}`}
                      className="overflow-hidden rounded-lg border border-outline-variant"
                    >
                      <div className="relative aspect-video bg-surface-container-low">
                        <Image
                          src={`/api/media/${media.fileId}/file`}
                          alt={media.altText ?? "İçerik görseli"}
                          fill
                          unoptimized
                          sizes="(min-width: 768px) 240px, 50vw"
                          className="object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="px-sm py-xs font-body-sm text-body-sm text-on-surface-variant">
                        {mediaRoleLabel(media.role)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <DetailRow label="Görsel" value="Görsel atanmamış" />
            )}
            {item.aiNotes ? (
              <DetailRow label="AI notu" value={item.aiNotes} />
            ) : null}
          </div>
        ) : null}

        {!isApproved && !isRejected ? (
          <div className="mt-auto flex flex-wrap gap-xs border-t border-outline-variant pt-sm">
            <button
              type="button"
              className="secondary-button flex-1 px-sm py-2 font-label-sm text-label-sm"
              disabled={busy}
              onClick={() => setDetailsOpen((current) => !current)}
            >
              <MaterialIcon name="visibility" size={16} />
              {detailsOpen ? "Kapat" : "Detay"}
            </button>
            <button
              type="button"
              className="secondary-button flex-1 px-sm py-2 font-label-sm text-label-sm"
              disabled={busy}
              onClick={() => onEdit(item)}
            >
              <MaterialIcon name="edit" size={16} />
              Düzenle
            </button>
            <button
              type="button"
              className="primary-button flex-1 px-sm py-2 font-label-sm text-label-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => onApprove(item.id)}
            >
              <MaterialIcon name="check_circle" size={16} />
              Onayla
            </button>
            <button
              type="button"
              className="secondary-button flex-1 px-sm py-2 font-label-sm text-label-sm text-error hover:bg-error-container/20"
              disabled={busy}
              onClick={() => onReject(item.id)}
            >
              <MaterialIcon name="cancel" size={16} />
              Reddet
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        {label}
      </p>
      <p className="whitespace-pre-line font-body-sm text-body-sm">{value}</p>
    </div>
  );
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonObj(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseMediaAssignments(value: string): MediaAssignment[] {
  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): MediaAssignment | null => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const media = item as Record<string, unknown>;
        const fileId = typeof media.fileId === "string" ? media.fileId : null;

        if (!fileId) {
          return null;
        }

        return {
          altText:
            typeof media.altText === "string" ? media.altText : undefined,
          fileId,
          order: typeof media.order === "number" ? media.order : undefined,
          role: typeof media.role === "string" ? media.role : "content_image"
        };
      })
      .filter((item): item is MediaAssignment => Boolean(item));
  } catch {
    return [];
  }
}

function extractTitle(
  data: Record<string, unknown>,
  contentType: string | null
): string {
  const candidates = [
    data.title,
    data.tweetText,
    data.caption,
    data.excerpt,
    stripHtml(typeof data.contentHtml === "string" ? data.contentHtml : "")
  ];
  const text = candidates.find(
    (value): value is string => typeof value === "string" && value.trim() !== ""
  );

  if (text) {
    return firstWords(text, 9);
  }

  return contentType ? (CONTENT_TYPE_LABELS[contentType] ?? contentType) : "";
}

function extractBody(data: Record<string, unknown>): string {
  const threadItems = Array.isArray(data.threadItems)
    ? data.threadItems.map(String).filter(Boolean)
    : [];
  const body =
    stringValue(data.tweetText) ??
    stringValue(data.caption) ??
    stringValue(data.excerpt) ??
    stripHtml(stringValue(data.contentHtml) ?? "");
  const linkUrl = stringValue(data.linkUrl);
  const parts = [body, ...threadItems, linkUrl].filter(Boolean);

  return parts.join("\n\n").trim();
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstWords(value: string, count: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const result = words.slice(0, count).join(" ");
  return words.length > count ? `${result}...` : result;
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function warningLabel(value: string) {
  const labels: Record<string, string> = {
    AMBIGUOUS_SCHEDULE: "Yayın tarihi belirsiz",
    CONTENT_TOO_LONG: "İçerik karakter limitini aşıyor",
    MEDIA_MATCH_UNCERTAIN: "Görsel eşleşmesi belirsiz"
  };

  return labels[value] ?? value;
}

function mediaRoleLabel(value: string) {
  const labels: Record<string, string> = {
    carousel_slide: "Carousel görseli",
    content_image: "İçerik görseli",
    featured_image: "Ana görsel"
  };

  return labels[value] ?? value;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(new Date(iso));
}
