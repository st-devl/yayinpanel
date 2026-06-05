"use client";

import { MaterialIcon } from "@/components/material-icon";

type BulkActionBarProps = {
  totalCount: number;
  selectedIds: string[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkApprove: (ids?: string[]) => void;
  onBulkReject: (ids?: string[]) => void;
  busy: boolean;
};

export function BulkActionBar({
  totalCount,
  selectedIds,
  onSelectAll,
  onDeselectAll,
  onBulkApprove,
  onBulkReject,
  busy
}: BulkActionBarProps) {
  const hasSelection = selectedIds.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-sm rounded-xl border border-outline-variant bg-surface-container-low px-md py-sm">
      <div className="flex items-center gap-sm">
        <button
          type="button"
          className="font-body-sm text-body-sm text-primary hover:underline"
          onClick={hasSelection ? onDeselectAll : onSelectAll}
        >
          {hasSelection ? "Seçimi Kaldır" : "Tümünü Seç"}
        </button>
        {hasSelection && (
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {selectedIds.length} / {totalCount} seçili
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-xs">
        <button
          type="button"
          className="primary-button px-md py-sm font-label-sm text-label-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => onBulkApprove()}
        >
          <MaterialIcon name="check_circle" size={16} />
          Tümünü Onayla
        </button>

        {hasSelection && (
          <>
            <button
              type="button"
              className="secondary-button px-md py-sm font-label-sm text-label-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => onBulkApprove(selectedIds)}
            >
              <MaterialIcon name="check" size={16} />
              Seçilenleri Onayla ({selectedIds.length})
            </button>
            <button
              type="button"
              className="secondary-button px-md py-sm font-label-sm text-label-sm text-error hover:bg-error-container/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => onBulkReject(selectedIds)}
            >
              <MaterialIcon name="block" size={16} />
              Seçilenleri Reddet
            </button>
          </>
        )}
      </div>
    </div>
  );
}
