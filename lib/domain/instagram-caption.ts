export type ParsedCaption = {
  index: number;
  caption: string;
  hashtags: string[];
};

export const CAPTION_DELIMITER = /^\s*---+\s*$/;

/**
 * Toplu caption metnini ayri gonderilere boler.
 * Gonderiler "---" satiriyla ayrilir. Her bloktan hashtagler cikarilir.
 */
export function parseBulkCaptions(input: string): ParsedCaption[] {
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of input.split(/\r?\n/)) {
    if (CAPTION_DELIMITER.test(line)) {
      blocks.push(current.join("\n"));
      current = [];
      continue;
    }
    current.push(line);
  }
  blocks.push(current.join("\n"));

  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((caption, index) => ({
      index,
      caption,
      hashtags: extractHashtags(caption)
    }));
}

/** Metindeki #hashtag'leri (# olmadan) cikarir. */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#([\p{L}\p{N}_]+)/gu) ?? [];
  return Array.from(new Set(matches.map((tag) => tag.slice(1))));
}

export type CaptionMediaMatch = {
  captions: ParsedCaption[];
  mediaCount: number;
  matched: number;
  missingMedia: number;
  missingCaption: number;
  balanced: boolean;
};

/**
 * Caption sayisi ile gorsel sayisini karsilastirir.
 * Eksik/fazla metin-gorsel uyarilari icin kullanilir.
 */
export function matchCaptionsWithMedia(
  captions: ParsedCaption[],
  mediaCount: number
): CaptionMediaMatch {
  const matched = Math.min(captions.length, mediaCount);

  return {
    captions,
    mediaCount,
    matched,
    missingMedia: Math.max(0, captions.length - mediaCount),
    missingCaption: Math.max(0, mediaCount - captions.length),
    balanced: captions.length === mediaCount
  };
}
