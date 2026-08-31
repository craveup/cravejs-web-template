import {
  StorefrontApiError,
  StorefrontClientStateError,
  StorefrontProtocolError,
  StorefrontTimeoutError,
} from "@craveup/storefront-sdk";

export type StorefrontUiErrorState =
  | "validation"
  | "authentication-required"
  | "access-denied"
  | "unavailable"
  | "rate-limited"
  | "cart-conflict"
  | "resource-conflict"
  | "cart-immutable"
  | "integration-error"
  | "operation-pending"
  | "dependency-unavailable"
  | "network-error"
  | "unexpected";

export type SafeStorefrontErrorDetail = string | number | boolean | null;

export interface StorefrontErrorState {
  readonly state: StorefrontUiErrorState;
  readonly code: string;
  readonly message: string;
  readonly requestId?: string;
  readonly details?: Readonly<Record<string, SafeStorefrontErrorDetail>>;
  readonly retryAfterMs?: number;
  readonly method?: string;
  readonly routeTemplate?: string;
}

const genericMessage = "Something went wrong. Please try again.";

const stateByPublicCode: Readonly<Record<string, StorefrontUiErrorState>> = {
  VALIDATION_ERROR: "validation",
  UNAUTHORIZED: "authentication-required",
  FORBIDDEN: "access-denied",
  NOT_FOUND: "unavailable",
  RATE_LIMITED: "rate-limited",
  CART_CONFLICT: "cart-conflict",
  RESOURCE_CONFLICT: "resource-conflict",
  CART_IMMUTABLE: "cart-immutable",
  IDEMPOTENCY_KEY_REQUIRED: "integration-error",
  IDEMPOTENCY_KEY_REUSED: "integration-error",
  IDEMPOTENCY_IN_PROGRESS: "operation-pending",
  DEPENDENCY_UNAVAILABLE: "dependency-unavailable",
  INTERNAL_ERROR: "unexpected",
};

const safeFieldIdentifier = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const safeNumericValidationDetails = new Set([
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
]);
const safeMethod = /^(?:DELETE|GET|PATCH|POST|PUT)$/;
const maximumRetryAfterMs = 60 * 60 * 1_000;

function sanitizeValidationDetails(
  details: Record<string, unknown> | undefined,
): Readonly<Record<string, SafeStorefrontErrorDetail>> | undefined {
  if (!details) return undefined;

  const safeEntries: Array<[string, SafeStorefrontErrorDetail]> = [];
  for (const [key, value] of Object.entries(details)) {
    if (
      safeNumericValidationDetails.has(key) &&
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      safeEntries.push([key, value]);
      continue;
    }
    if (key === "required" && typeof value === "boolean") {
      safeEntries.push([key, value]);
      continue;
    }
    if (
      (key === "field" || key === "modifierGroupId") &&
      typeof value === "string" &&
      safeFieldIdentifier.test(value)
    ) {
      safeEntries.push([key, value]);
    }
  }

  return safeEntries.length > 0 ? Object.fromEntries(safeEntries) : undefined;
}

function sanitizeCode(code: string): string {
  return code.length > 0 ? code : "HTTP_ERROR";
}

function sanitizeRequestId(requestId: string | undefined): string | undefined {
  return requestId !== undefined && requestId.length >= 8
    ? requestId
    : undefined;
}

function sanitizeMethod(method: string): string | undefined {
  return safeMethod.test(method) ? method : undefined;
}

function sanitizeRetryAfterMs(value: number | undefined): number | undefined {
  return value !== undefined &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximumRetryAfterMs
    ? value
    : undefined;
}

function sanitizeRouteTemplate(routeTemplate: string): string | undefined {
  if (
    routeTemplate.length === 0 ||
    routeTemplate.length > 256 ||
    !routeTemplate.startsWith("/") ||
    routeTemplate.startsWith("//") ||
    routeTemplate.includes("\\") ||
    routeTemplate.includes("?") ||
    routeTemplate.includes("#") ||
    routeTemplate.includes("..") ||
    /[\r\n]/.test(routeTemplate)
  ) {
    return undefined;
  }

  return routeTemplate;
}

function safePublicMessage(error: StorefrontApiError, code: string): string {
  if (code === "INTERNAL_ERROR" || !Object.hasOwn(stateByPublicCode, code)) {
    return genericMessage;
  }
  if (error.message.length === 0) {
    return genericMessage;
  }
  return error.message;
}

function transportContext(
  method: string,
  routeTemplate: string,
): Pick<StorefrontErrorState, "method" | "routeTemplate"> {
  const safeHttpMethod = sanitizeMethod(method);
  const safeRoute = sanitizeRouteTemplate(routeTemplate);

  return {
    ...(safeHttpMethod ? { method: safeHttpMethod } : {}),
    ...(safeRoute ? { routeTemplate: safeRoute } : {}),
  };
}

function mapClientStateError(
  error: StorefrontClientStateError,
): StorefrontErrorState {
  if (error.code === "CUSTOMER_AUTH_REQUIRED") {
    return {
      state: "authentication-required",
      code: error.code,
      message: "Please sign in to continue.",
    };
  }
  if (
    error.code === "CART_CAPABILITY_REQUIRED" ||
    error.code === "CART_OR_CUSTOMER_AUTH_REQUIRED"
  ) {
    return {
      state: "access-denied",
      code: error.code,
      message: "This session is no longer available. Please start again.",
    };
  }

  return {
    state: "integration-error",
    code: error.code,
    message: genericMessage,
  };
}

export function toStorefrontErrorState(error: unknown): StorefrontErrorState {
  if (error instanceof StorefrontApiError) {
    const code = sanitizeCode(error.code);
    const requestId = sanitizeRequestId(error.requestId);
    const retryAfterMs =
      code === "RATE_LIMITED"
        ? sanitizeRetryAfterMs(error.retryAfterMs)
        : undefined;
    const details =
      code === "VALIDATION_ERROR"
        ? sanitizeValidationDetails(error.details)
        : undefined;

    return {
      state: stateByPublicCode[code] ?? "unexpected",
      code,
      message: safePublicMessage(error, code),
      ...(requestId ? { requestId } : {}),
      ...(details ? { details } : {}),
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
      ...transportContext(error.method, error.routeTemplate),
    };
  }

  if (error instanceof StorefrontTimeoutError) {
    return {
      state: "network-error",
      code: "REQUEST_TIMEOUT",
      message: "The request took too long. Please try again.",
      ...transportContext(error.method, error.routeTemplate),
    };
  }

  if (error instanceof StorefrontProtocolError) {
    return {
      state: "unexpected",
      code: "INVALID_RESPONSE",
      message: genericMessage,
      ...transportContext(error.method, error.routeTemplate),
    };
  }

  if (error instanceof StorefrontClientStateError) {
    return mapClientStateError(error);
  }

  return {
    state: "unexpected",
    code: "UNKNOWN_ERROR",
    message: genericMessage,
  };
}
