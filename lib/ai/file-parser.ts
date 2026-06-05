const SUPPORTED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "text/markdown",
  "text/plain",
  "text/x-markdown"
] as const;

export type SupportedDocMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export function isSupportedDocMimeType(
  mimeType: string
): mimeType is SupportedDocMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export async function parseFileToText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return parseDocx(buffer);
  }

  if (mimeType === "application/pdf") {
    return parsePdf(buffer);
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/x-markdown"
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    `Desteklenmeyen dosya türü: ${mimeType}. Kabul edilen türler: .docx, .pdf, .md, .txt`
  );
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length > 0) {
    const errors = result.messages.filter((m) => m.type === "error");
    if (errors.length > 0) {
      throw new Error(`Word dosyası okunamadı: ${errors[0]?.message}`);
    }
  }

  return result.value.trim();
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (await import("pdf-parse")) as any;
  const fn = pdfParse.default ?? pdfParse;
  const result = await fn(buffer) as { text: string };
  return result.text.trim();
}
