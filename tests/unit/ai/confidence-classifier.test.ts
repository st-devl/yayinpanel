import { describe, expect, it } from "vitest";
import { classifyConfidence } from "@/lib/ai/confidence-classifier";

describe("classifyConfidence", () => {
  it("returns HIGH for score >= 0.85", () => {
    expect(classifyConfidence(0.85)).toBe("HIGH");
    expect(classifyConfidence(0.92)).toBe("HIGH");
    expect(classifyConfidence(1.0)).toBe("HIGH");
  });

  it("returns MEDIUM for score 0.65-0.84", () => {
    expect(classifyConfidence(0.65)).toBe("MEDIUM");
    expect(classifyConfidence(0.75)).toBe("MEDIUM");
    expect(classifyConfidence(0.84)).toBe("MEDIUM");
  });

  it("returns LOW for score 0.40-0.64", () => {
    expect(classifyConfidence(0.40)).toBe("LOW");
    expect(classifyConfidence(0.55)).toBe("LOW");
    expect(classifyConfidence(0.64)).toBe("LOW");
  });

  it("returns CRITICAL for score < 0.40", () => {
    expect(classifyConfidence(0.39)).toBe("CRITICAL");
    expect(classifyConfidence(0.20)).toBe("CRITICAL");
    expect(classifyConfidence(0.0)).toBe("CRITICAL");
  });

  it("boundary values are correct", () => {
    expect(classifyConfidence(0.85)).toBe("HIGH");
    expect(classifyConfidence(0.849)).toBe("MEDIUM");
    expect(classifyConfidence(0.65)).toBe("MEDIUM");
    expect(classifyConfidence(0.649)).toBe("LOW");
    expect(classifyConfidence(0.40)).toBe("LOW");
    expect(classifyConfidence(0.399)).toBe("CRITICAL");
  });
});
