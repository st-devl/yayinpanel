import { describe, expect, it } from "vitest";
import {
  classifyHttpStatus,
  normalizeUnknownError,
  PublishError
} from "@/lib/publishers/errors";
import { computeBackoffSeconds } from "@/lib/server/scheduler-core";

describe("publish error classification", () => {
  it("classifies 401/403 as AUTH", () => {
    expect(classifyHttpStatus(401, "C", "m").kind).toBe("AUTH");
    expect(classifyHttpStatus(403, "C", "m").kind).toBe("AUTH");
  });

  it("classifies 429 and 5xx as TRANSIENT", () => {
    expect(classifyHttpStatus(429, "C", "m").isTransient).toBe(true);
    expect(classifyHttpStatus(500, "C", "m").isTransient).toBe(true);
    expect(classifyHttpStatus(503, "C", "m").isTransient).toBe(true);
  });

  it("classifies other 4xx as PERMANENT", () => {
    expect(classifyHttpStatus(400, "C", "m").isPermanent).toBe(true);
    expect(classifyHttpStatus(422, "C", "m").isPermanent).toBe(true);
  });

  it("normalizes unknown errors as TRANSIENT", () => {
    const error = normalizeUnknownError(new Error("network down"));
    expect(error).toBeInstanceOf(PublishError);
    expect(error.isTransient).toBe(true);
  });
});

describe("scheduler backoff", () => {
  it("grows exponentially and caps at 30 minutes", () => {
    expect(computeBackoffSeconds(1)).toBe(60);
    expect(computeBackoffSeconds(2)).toBe(120);
    expect(computeBackoffSeconds(3)).toBe(240);
    expect(computeBackoffSeconds(20)).toBe(1800);
  });
});
