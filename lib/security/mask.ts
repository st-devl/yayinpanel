const sensitiveKeys = [
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "authorization",
  "Authorization",
  "api_key",
  "apiKey",
  "password",
  "secret",
  "token"
];

export function maskSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitiveValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        sensitiveKeys.some((sensitiveKey) =>
          key.toLowerCase().includes(sensitiveKey.toLowerCase())
        )
          ? "[masked]"
          : maskSensitiveValue(entryValue)
      ])
    );
  }

  if (typeof value === "string" && value.length > 80) {
    return `${value.slice(0, 12)}...[masked]`;
  }

  return value;
}

export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(maskSensitiveValue(value));
}
