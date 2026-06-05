import { describe, expect, it } from "vitest";
import { validatePlatformData } from "@/lib/domain/platform-data";
import {
  parsePlatformData,
  serializePlatformData
} from "@/lib/domain/platform-data-store";

describe("platformData validation", () => {
  it("validates instagram platform data with defaults", () => {
    const data = validatePlatformData("INSTAGRAM", {});
    expect(data).toMatchObject({ postType: "IMAGE", hashtags: [] });
  });

  it("validates X platform data", () => {
    const data = validatePlatformData("X", { hasMedia: true });
    expect(data).toMatchObject({ hasMedia: true, isThread: false });
  });

  it("requires title and slug for WordPress", () => {
    expect(() =>
      validatePlatformData("WORDPRESS", { contentHtml: "x" })
    ).toThrow();

    const data = validatePlatformData("WORDPRESS", {
      title: "Baslik",
      slug: "baslik"
    });
    expect(data).toMatchObject({ title: "Baslik", publishStatus: "publish" });
  });

  it("round-trips through serialize/parse", () => {
    const serialized = serializePlatformData("WORDPRESS", {
      title: "T",
      slug: "t"
    });
    const parsed = parsePlatformData("WORDPRESS", serialized);
    expect(parsed).toMatchObject({ title: "T", slug: "t" });
  });
});
