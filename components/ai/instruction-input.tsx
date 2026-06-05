"use client";

import { MaterialIcon } from "@/components/material-icon";

const EXAMPLES = [
  "Bu içerikleri birer hafta arayla paylaş.",
  "İlk paylaşım pazartesi saat 10:00'da yayınlansın.",
  "Her cuma saat 18:00'de bir içerik paylaş.",
  "İçerikleri üçer gün arayla paylaş.",
  "Görseller dosya isimlerindeki numaraya göre eşleştirilsin."
];

type InstructionInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function InstructionInput({ value, onChange, disabled }: InstructionInputProps) {
  return (
    <div className="space-y-sm">
      <label className="block">
        <span className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant">
          <MaterialIcon name="schedule" size={16} />
          Yayınlama Talimatı
          <span className="font-body-sm text-body-sm text-outline">(opsiyonel)</span>
        </span>
        <textarea
          className="input-surface mt-xs w-full resize-none rounded-lg px-3 py-2 font-body-sm text-body-sm"
          rows={3}
          placeholder="Örn: Bu yazıları bir hafta arayla, her pazartesi saat 10:00'da yayınla."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <span className="block text-right font-body-sm text-body-sm text-outline">
          {value.length} karakter
        </span>
      </label>

      <div className="rounded-lg border border-outline-variant bg-surface-container-low p-sm">
        <p className="mb-xs font-label-sm text-label-sm text-on-surface-variant">
          Örnek talimatlar:
        </p>
        <div className="flex flex-wrap gap-xs">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="rounded-md border border-outline-variant bg-surface px-sm py-xs font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container transition-colors"
              onClick={() => onChange(ex)}
              disabled={disabled}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
