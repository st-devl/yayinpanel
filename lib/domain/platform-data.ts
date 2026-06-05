import { z } from "zod";

export const instagramPlatformDataSchema = z.object({
  platform: z.literal("INSTAGRAM").optional(),
  postType: z.enum(["IMAGE"]).default("IMAGE"),
  hashtags: z.array(z.string().min(1)).default([]),
  captionStyle: z.string().optional()
});

export const xPlatformDataSchema = z.object({
  platform: z.literal("X").optional(),
  linkUrl: z.string().url().optional().or(z.literal("")),
  hasMedia: z.boolean().default(false),
  isThread: z.literal(false).default(false)
});

export const wordpressPlatformDataSchema = z.object({
  platform: z.literal("WORDPRESS").optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  contentHtml: z.string().default(""),
  excerpt: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  categoryIds: z.array(z.number().int()).default([]),
  tagIds: z.array(z.number().int()).default([]),
  publishStatus: z.enum(["publish", "draft"]).default("publish")
});

export const customSitePlatformDataSchema = z.object({
  platform: z.literal("CUSTOM_SITE").optional(),
  title: z.string().min(1),
  slug: z.string().optional(),
  contentHtml: z.string().default(""),
  excerpt: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  publishStatus: z.enum(["publish", "draft"]).default("publish"),
  extra: z.record(z.string(), z.unknown()).optional()
});

export const platformDataByPlatform = {
  INSTAGRAM: instagramPlatformDataSchema,
  X: xPlatformDataSchema,
  WORDPRESS: wordpressPlatformDataSchema,
  CUSTOM_SITE: customSitePlatformDataSchema
} as const;

export type InstagramPlatformData = z.infer<typeof instagramPlatformDataSchema>;
export type XPlatformData = z.infer<typeof xPlatformDataSchema>;
export type WordPressPlatformData = z.infer<typeof wordpressPlatformDataSchema>;
export type CustomSitePlatformData = z.infer<typeof customSitePlatformDataSchema>;
export type PlatformData =
  | InstagramPlatformData
  | XPlatformData
  | WordPressPlatformData
  | CustomSitePlatformData;

export function validatePlatformData(
  platform: keyof typeof platformDataByPlatform,
  value: unknown
): PlatformData {
  return platformDataByPlatform[platform].parse(value);
}
