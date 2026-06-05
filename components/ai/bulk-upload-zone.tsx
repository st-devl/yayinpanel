"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { MaterialIcon } from "@/components/material-icon";

const ACCEPTED_DOC_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "text/markdown",
  "text/plain",
  "text/x-markdown"
];

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

export type UploadedFile = {
  file: File;
  type: "document" | "image";
  preview?: string;
};

type BulkUploadZoneProps = {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
};

export function BulkUploadZone({ files, onChange, disabled }: BulkUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function classifyFile(file: File): "document" | "image" | null {
    if (ACCEPTED_DOC_TYPES.includes(file.type)) return "document";
    if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return "image";
    // .md uzantısı için fallback
    if (file.name.endsWith(".md") || file.name.endsWith(".txt")) return "document";
    return null;
  }

  function addFiles(newFiles: FileList | File[]) {
    const added: UploadedFile[] = [];

    for (const file of Array.from(newFiles)) {
      const type = classifyFile(file);
      if (!type) continue;

      const uploaded: UploadedFile = { file, type };

      if (type === "image") {
        uploaded.preview = URL.createObjectURL(file);
      }

      added.push(uploaded);
    }

    if (added.length > 0) {
      onChange([...files, ...added]);
    }
  }

  function removeFile(index: number) {
    const updated = files.filter((_, i) => i !== index);
    const removed = files[index];
    if (removed?.preview) URL.revokeObjectURL(removed.preview);
    onChange(updated);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (!disabled && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }

  const docFiles = files.filter((f) => f.type === "document");
  const imgFiles = files.filter((f) => f.type === "image");

  return (
    <div className="space-y-sm">
      <div
        className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-sm rounded-xl border-2 border-dashed p-md transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-outline-variant bg-surface-container-low hover:bg-surface-container"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <MaterialIcon
          name="upload_file"
          className="text-outline"
          size={36}
        />
        <div className="text-center">
          <p className="font-label-md text-label-md text-on-surface-variant">
            Dosyaları buraya sürükle veya tıkla
          </p>
          <p className="font-body-sm text-body-sm text-outline">
            .docx, .pdf, .md, .txt ve görseller (.jpg, .png, .webp)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".docx,.pdf,.md,.txt,image/jpeg,image/png,image/webp,text/plain"
          onChange={handleChange}
          disabled={disabled}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-xs">
          {docFiles.length > 0 && (
            <div>
              <p className="mb-xs font-label-sm text-label-sm text-on-surface-variant">
                Dokümanlar ({docFiles.length})
              </p>
              <div className="space-y-xs">
                {docFiles.map((f, i) => {
                  const globalIdx = files.indexOf(f);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-sm rounded-lg border border-outline-variant bg-surface-container-low px-sm py-xs"
                    >
                      <div className="flex min-w-0 items-center gap-xs">
                        <MaterialIcon name="description" className="shrink-0 text-outline" size={16} />
                        <span className="truncate font-body-sm text-body-sm">{f.file.name}</span>
                        <span className="shrink-0 font-body-sm text-body-sm text-outline">
                          ({(f.file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-outline hover:text-error"
                        onClick={(e) => { e.stopPropagation(); removeFile(globalIdx); }}
                      >
                        <MaterialIcon name="close" size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {imgFiles.length > 0 && (
            <div>
              <p className="mb-xs font-label-sm text-label-sm text-on-surface-variant">
                Görseller ({imgFiles.length})
              </p>
              <div className="flex flex-wrap gap-sm">
                {imgFiles.map((f, i) => {
                  const globalIdx = files.indexOf(f);
                  return (
                    <div key={i} className="relative h-20 w-20 shrink-0">
                      {f.preview && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.preview}
                          alt={f.file.name}
                          className="h-full w-full rounded-lg object-cover"
                        />
                      )}
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-white"
                        onClick={(e) => { e.stopPropagation(); removeFile(globalIdx); }}
                      >
                        <MaterialIcon name="close" size={12} />
                      </button>
                      <p className="mt-xs truncate text-center text-[10px] text-outline">
                        {f.file.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
