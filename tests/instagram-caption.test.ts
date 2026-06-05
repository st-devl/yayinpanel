import { describe, expect, it } from "vitest";
import {
  extractHashtags,
  matchCaptionsWithMedia,
  parseBulkCaptions
} from "@/lib/domain/instagram-caption";

describe("instagram caption parser", () => {
  it("splits captions by --- delimiter", () => {
    const input = "Birinci gonderi\n#bir\n---\nIkinci gonderi #iki #uc";
    const captions = parseBulkCaptions(input);

    expect(captions).toHaveLength(2);
    expect(captions[0].caption).toBe("Birinci gonderi\n#bir");
    expect(captions[0].hashtags).toEqual(["bir"]);
    expect(captions[1].hashtags).toEqual(["iki", "uc"]);
  });

  it("ignores empty blocks", () => {
    expect(parseBulkCaptions("\n\n---\n\n")).toHaveLength(0);
  });

  it("extracts unique hashtags including unicode", () => {
    expect(extractHashtags("#Kurban #bayram #Kurban #2026")).toEqual([
      "Kurban",
      "bayram",
      "2026"
    ]);
  });

  it("reports missing media and caption counts", () => {
    const captions = parseBulkCaptions("a\n---\nb\n---\nc");
    const balanced = matchCaptionsWithMedia(captions, 3);
    expect(balanced.balanced).toBe(true);

    const tooFewMedia = matchCaptionsWithMedia(captions, 1);
    expect(tooFewMedia.missingMedia).toBe(2);
    expect(tooFewMedia.balanced).toBe(false);

    const tooManyMedia = matchCaptionsWithMedia(captions, 5);
    expect(tooManyMedia.missingCaption).toBe(2);
  });
});
