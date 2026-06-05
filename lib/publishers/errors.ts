import "server-only";

/**
 * Yayinlama hatalarini kalici (permanent) ve gecici (transient) olarak
 * siniflandirir. Scheduler bu ayrima gore retry yapip yapmayacagina karar verir.
 */
export type PublishErrorKind = "PERMANENT" | "TRANSIENT" | "AUTH";

export class PublishError extends Error {
  readonly kind: PublishErrorKind;
  readonly code: string;
  readonly httpStatus?: number;
  readonly apiResponse?: unknown;

  constructor(
    kind: PublishErrorKind,
    code: string,
    message: string,
    options?: { httpStatus?: number; apiResponse?: unknown; cause?: unknown }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "PublishError";
    this.kind = kind;
    this.code = code;
    this.httpStatus = options?.httpStatus;
    this.apiResponse = options?.apiResponse;
  }

  get isAuth() {
    return this.kind === "AUTH";
  }

  get isTransient() {
    return this.kind === "TRANSIENT";
  }

  get isPermanent() {
    return this.kind === "PERMANENT";
  }
}

/** 401/403 -> AUTH (token yenileme denenebilir). */
export function authError(code: string, message: string, httpStatus?: number) {
  return new PublishError("AUTH", code, message, { httpStatus });
}

/** 429/5xx/network -> TRANSIENT (retry edilir). */
export function transientError(
  code: string,
  message: string,
  options?: { httpStatus?: number; apiResponse?: unknown; cause?: unknown }
) {
  return new PublishError("TRANSIENT", code, message, options);
}

/** 4xx (validation vb.) -> PERMANENT (retry edilmez). */
export function permanentError(
  code: string,
  message: string,
  options?: { httpStatus?: number; apiResponse?: unknown; cause?: unknown }
) {
  return new PublishError("PERMANENT", code, message, options);
}

/**
 * HTTP yanitini standart bir PublishError'a cevirir.
 * - 401/403 => AUTH
 * - 408/429/5xx => TRANSIENT
 * - diger 4xx => PERMANENT
 */
export function classifyHttpStatus(
  status: number,
  code: string,
  message: string,
  apiResponse?: unknown
): PublishError {
  if (status === 401 || status === 403) {
    return new PublishError("AUTH", code, message, {
      httpStatus: status,
      apiResponse
    });
  }

  if (status === 408 || status === 429 || status >= 500) {
    return new PublishError("TRANSIENT", code, message, {
      httpStatus: status,
      apiResponse
    });
  }

  return new PublishError("PERMANENT", code, message, {
    httpStatus: status,
    apiResponse
  });
}

/** Ag/zaman asimi gibi exception'lari TRANSIENT olarak normalize eder. */
export function normalizeUnknownError(error: unknown): PublishError {
  if (error instanceof PublishError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : "Bilinmeyen yayinlama hatasi";

  return transientError("NETWORK_ERROR", message, { cause: error });
}
