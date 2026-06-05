"use client";

import { MaterialIcon } from "@/components/material-icon";

type ProcessingIndicatorProps = {
  fileCount?: number;
};

export function ProcessingIndicator({ fileCount = 1 }: ProcessingIndicatorProps) {
  const estimatedSeconds = Math.max(10, fileCount * 4);
  const estimatedStr =
    estimatedSeconds < 60
      ? `~${estimatedSeconds} saniye`
      : `~${Math.ceil(estimatedSeconds / 60)} dakika`;

  return (
    <div className="flex flex-col items-center justify-center gap-md py-xl text-center">
      <div className="relative">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <MaterialIcon
          name="auto_awesome"
          className="absolute inset-0 m-auto text-primary"
          size={28}
        />
      </div>
      <div>
        <p className="font-headline-sm text-headline-sm">
          Yapay zekâ içerikleri analiz ediyor...
        </p>
        <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
          İçerikler ayrıştırılıyor, alanlar dolduruluyor ve yayın planı hazırlanıyor.
        </p>
        <p className="mt-xs font-body-sm text-body-sm text-outline">
          Tahmini süre: {estimatedStr}
        </p>
      </div>
      <p className="font-body-sm text-body-sm text-outline">
        Bu sayfadan ayrılmayın, işlem devam ediyor.
      </p>
    </div>
  );
}
