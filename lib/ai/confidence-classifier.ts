import type { ConfidenceLevel } from "@/lib/ai/types";

export function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= 0.85) return "HIGH";
  if (score >= 0.65) return "MEDIUM";
  if (score >= 0.40) return "LOW";
  return "CRITICAL";
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  HIGH: "Yüksek Güven",
  MEDIUM: "Orta Güven",
  LOW: "Düşük Güven",
  CRITICAL: "Kritik Belirsizlik"
};

export const CONFIDENCE_COLORS: Record<
  ConfidenceLevel,
  { bg: string; text: string; border: string }
> = {
  HIGH: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200"
  },
  MEDIUM: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200"
  },
  LOW: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200"
  },
  CRITICAL: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200"
  }
};
