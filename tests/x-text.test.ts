import { describe, expect, it } from "vitest";
import {
  analyzeXText,
  isXTextOverLimit,
  X_MAX_WEIGHTED_LENGTH
} from "@/lib/domain/x-text";

describe("X text analysis", () => {
  it("counts a short tweet as valid", () => {
    const result = analyzeXText("Merhaba dunya");
    expect(result.weightedLength).toBe(13);
    expect(result.valid).toBe(true);
    expect(result.overBy).toBe(0);
  });

  it("counts links with fixed t.co weight, not raw length", () => {
    const longUrl =
      "https://example.com/" + "a".repeat(200) + "?q=very-long-query-string";
    const result = analyzeXText(`Link: ${longUrl}`);

    // Ham uzunluk 200+ olmasina ragmen agirlikli uzunluk t.co (23) ile sinirli.
    expect(result.weightedLength).toBeLessThan(longUrl.length);
    expect(result.weightedLength).toBeLessThanOrEqual(X_MAX_WEIGHTED_LENGTH);
  });

  it("detects over-limit text", () => {
    expect(isXTextOverLimit("a".repeat(281))).toBe(true);
    expect(isXTextOverLimit("a".repeat(280))).toBe(false);
  });
});
