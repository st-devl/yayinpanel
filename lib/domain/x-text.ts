import twitterText from "twitter-text";

export const X_MAX_WEIGHTED_LENGTH = 280;

export type XTextAnalysis = {
  weightedLength: number;
  valid: boolean;
  permillage: number;
  /** Limit asilirsa kac agirlikli karakter fazla. */
  overBy: number;
};

/**
 * X gonderi metnini agirlikli uzunluk ile analiz eder.
 * Linkler twitter-text tarafindan sabit (t.co) uzunlukla sayilir,
 * bu yuzden `text.length` yerine bu fonksiyon kullanilmalidir.
 */
export function analyzeXText(text: string): XTextAnalysis {
  const parsed = twitterText.parseTweet(text);

  return {
    weightedLength: parsed.weightedLength,
    valid: parsed.valid,
    permillage: parsed.permillage,
    overBy: Math.max(0, parsed.weightedLength - X_MAX_WEIGHTED_LENGTH)
  };
}

/** Metin X limitini asiyorsa true doner (planlamayi engellemek icin). */
export function isXTextOverLimit(text: string): boolean {
  return analyzeXText(text).weightedLength > X_MAX_WEIGHTED_LENGTH;
}
