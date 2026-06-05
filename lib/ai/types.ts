export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIRequestOptions = {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

export type AIResponse = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export type ContentType =
  | "blog_post"
  | "news"
  | "announcement"
  | "instagram_post"
  | "instagram_carousel"
  | "x_post"
  | "x_thread"
  | "campaign"
  | "product"
  | string;

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "CRITICAL";

export type MediaAssignment = {
  fileId: string;
  role: "featured_image" | "content_image" | "carousel_slide";
  altText?: string;
  order?: number;
};

export type ParsedSchedule = {
  scheduledAt: Date | null;
  isInferred: boolean;
};

export type ProcessedContent = {
  platform: "website" | "instagram" | "x";
  contentType: ContentType;
  targetAccountId: string;
  title?: string;
  summary?: string;
  slug?: string;
  contentHtml?: string;
  seoTitle?: string;
  seoDescription?: string;
  category?: string;
  tags?: string[];
  caption?: string;
  hashtags?: string[];
  tweetText?: string;
  threadItems?: string[];
  media: MediaAssignment[];
  scheduledAt: Date | null;
  scheduleIsInferred: boolean;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  warnings: string[];
  aiNotes?: string;
};
