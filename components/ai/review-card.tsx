"use client";

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

type ReviewCardProps = {
  item: ReviewItemData;
  selected: boolean;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (item: ReviewItemData) => void;
  busy: boolean;
};

const PLATFORM_META: Record<string, { icon: string; label: string }> = {
  INSTAGRAM: { icon: "photo_camera", label: "Instagram" },
  X: { icon: "share", label: "X" },
  WORDPRESS: { icon: "web", label: "WordPress" },
  CUSTOM_SITE: { icon: "code", label: "Özel Site" }
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

export function ReviewCard({
  item,
  selected,
  onSelect,
  onApprove,
  onReject,
  onEdit,
  busy
}: ReviewCardProps) {
  const platformMeta = PLATFORM_META[item.platform] ?? {
    icon: "article",
    label: item.platform
  };
  const confidenceLevel = classifyConfidence(item.confidence);
  const confidenceStyle = CONFIDENCE_COLORS[confidenceLevel];
  const warnings = parseJsonArray(item.warnings);
  const platformData = parseJsonObj(item.proposedPlatformData);
  const title = extractTitle(platformData, item.contentType);
  const isApproved = item.reviewStatus === "APPROVED";
  const isRejected = item.reviewStatus === "REJECTED";

  const statusTone = REVIEW_STATUS_TONES[item.reviewStatus] ?? "neutral";

  return (
    <article
      className={`panel-card flex flex-col gap-sm p-md transition-shadow hover:shadow-panel-sm ${
        selected ? "ring-2 ring-primary" : ""
      } ${isApproved ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-sm">
        <input
          type="checkbox"
          className="mt-1 shrink-0"
          checked={selected}
          onChange={() => onSelect(item.id)}
          disabled={isApproved || isRejected}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-xs">
          <div className="flex flex-wrap items-center justify-between gap-xs">
            <div className="flex items-center gap-xs">
              <MaterialIcon name={platformMeta.icon} size={16} className="text-outline" />
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {platformMeta.label}
              </span>
              {item.contentType && (
                <span className="rounded bg-surface-container-low px-xs py-0.5 font-body-sm text-body-sm text-outline">
                  {item.contentType}
                </span>
              )}
            </div>
            <StatusBadge tone={statusTone}>{item.reviewStatus}</StatusBadge>
          </div>

          <h3 className="truncate font-headline-sm text-headline-sm">
            {title || "(Başlık yok)"}
          </h3>

          <div className="flex flex-wrap items-center gap-sm">
            {item.scheduledAt ? (
              <div className="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant">
                <MaterialIcon name="schedule" size={14} />
                {formatDate(item.scheduledAt)}
              </div>
            ) : (
              <div className="flex items-center gap-xs font-body-sm text-body-sm text-amber-600">
                <MaterialIcon name="warning" size={14} />
                Tarih belirsiz
              </div>
            )}

            <span
              className={`rounded-md border px-xs py-0.5 font-label-sm text-label-sm ${confidenceStyle.bg} ${confidenceStyle.text} ${confidenceStyle.border}`}
            >
              {CONFIDENCE_LABELS[confidenceLevel]} ({Math.round(item.confidence * 100)}%)
            </span>

            {warnings.length > 0 && (
              <span className="flex items-center gap-xs font-body-sm text-body-sm text-amber-600">
                <MaterialIcon name="warning" size={14} />
                {warnings.length} uyarı
              </span>
            )}
          </div>

          {warnings.length > 0 && (
            <ul className="space-y-xs">
              {warnings.map((w) => (
                <li
                  key={w}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-sm py-xs font-body-sm text-body-sm text-amber-800"
                >
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!isApproved && !isRejected && (
        <div className="flex gap-xs border-t border-outline-variant pt-sm">
          <button
            type="button"
            className="primary-button flex-1 py-2 font-label-sm text-label-sm disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={() => onApprove(item.id)}
          >
            <MaterialIcon name="check" size={16} />
            Onayla
          </button>
          <button
            type="button"
            className="secondary-button flex-1 py-2 font-label-sm text-label-sm"
            disabled={busy}
            onClick={() => onEdit(item)}
          >
            <MaterialIcon name="edit" size={16} />
            Düzenle
          </button>
          <button
            type="button"
            className="secondary-button py-2 px-sm font-label-sm text-label-sm text-error hover:bg-error-container/20"
            disabled={busy}
            onClick={() => onReject(item.id)}
          >
            <MaterialIcon name="close" size={16} />
          </button>
        </div>
      )}
    </article>
  );
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObj(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractTitle(
  data: Record<string, unknown>,
  contentType: string | null
): string {
  if (typeof data.title === "string") return data.title;
  if (typeof data.caption === "string") return data.caption.slice(0, 80);
  if (typeof data.tweetText === "string") return data.tweetText.slice(0, 80);
  return contentType ?? "";
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(new Date(iso));
}
