/**
 * AI'ın standart çıktısını (title, content, slug vs.) bir web sitesinin
 * özel alan adlarına (headline, body, urlKey vs.) dönüştürür.
 *
 * fieldMappingJson örneği: { "title": "headline", "contentHtml": "body" }
 * Eşleşme yoksa orijinal alan adı kullanılır.
 */
export function mapToSiteFields(
  standardData: Record<string, unknown>,
  fieldMappingJson: string | null | undefined
): Record<string, unknown> {
  if (!fieldMappingJson) {
    return standardData;
  }

  let mapping: Record<string, string>;

  try {
    mapping = JSON.parse(fieldMappingJson) as Record<string, string>;
  } catch {
    return standardData;
  }

  const result: Record<string, unknown> = {};

  for (const [standardKey, value] of Object.entries(standardData)) {
    const siteKey = mapping[standardKey] ?? standardKey;
    result[siteKey] = value;
  }

  return result;
}

/** Geçerli bir field mapping JSON string'i mi kontrol eder. */
export function validateFieldMappingJson(json: string): boolean {
  try {
    const parsed: unknown = JSON.parse(json);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return false;
    }

    return Object.values(parsed as Record<string, unknown>).every(
      (v) => typeof v === "string"
    );
  } catch {
    return false;
  }
}

/** Standart AI alanlarının listesi (UI'da sol kolonda gösterilir). */
export const STANDARD_AI_FIELDS = [
  "title",
  "summary",
  "slug",
  "contentHtml",
  "seoTitle",
  "seoDescription",
  "category",
  "tags",
  "featuredImageUrl",
  "publishAt"
] as const;

export type StandardAIField = (typeof STANDARD_AI_FIELDS)[number];
