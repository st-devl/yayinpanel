import { describe, expect, it } from "vitest";
import {
  mapToSiteFields,
  validateFieldMappingJson
} from "@/lib/ai/field-mapper";

describe("mapToSiteFields", () => {
  const standardData = {
    title: "Test Başlık",
    contentHtml: "<p>İçerik</p>",
    slug: "test-baslik",
    seoTitle: "SEO Başlık"
  };

  it("returns original data when no mapping", () => {
    expect(mapToSiteFields(standardData, null)).toEqual(standardData);
    expect(mapToSiteFields(standardData, undefined)).toEqual(standardData);
  });

  it("maps fields according to mapping", () => {
    const mapping = JSON.stringify({
      title: "headline",
      contentHtml: "body",
      slug: "urlKey"
    });

    const result = mapToSiteFields(standardData, mapping);

    expect(result.headline).toBe("Test Başlık");
    expect(result.body).toBe("<p>İçerik</p>");
    expect(result.urlKey).toBe("test-baslik");
    expect(result.seoTitle).toBe("SEO Başlık"); // unmapped, keeps original key
    expect(result.title).toBeUndefined();
  });

  it("keeps unmapped fields with original key", () => {
    const mapping = JSON.stringify({ title: "headline" });
    const result = mapToSiteFields(standardData, mapping);

    expect(result.headline).toBe("Test Başlık");
    expect(result.contentHtml).toBe("<p>İçerik</p>"); // unchanged
  });

  it("handles invalid JSON gracefully", () => {
    const result = mapToSiteFields(standardData, "invalid-json");
    expect(result).toEqual(standardData);
  });
});

describe("validateFieldMappingJson", () => {
  it("accepts valid mapping", () => {
    expect(
      validateFieldMappingJson('{"title": "headline", "content": "body"}')
    ).toBe(true);
  });

  it("rejects invalid JSON", () => {
    expect(validateFieldMappingJson("not json")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(validateFieldMappingJson('{"title": 42}')).toBe(false);
  });

  it("rejects arrays", () => {
    expect(validateFieldMappingJson('["title", "content"]')).toBe(false);
  });
});
