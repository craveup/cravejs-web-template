import type {
  PrepareCheckoutHandoffResponse,
  RequestConfig,
  StorefrontCartSession,
  StorefrontSessionStore,
} from "@craveup/storefront-sdk";

import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "./action-input";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";

export interface StorefrontCheckoutClient {
  readonly checkout: {
    prepare(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<PrepareCheckoutHandoffResponse>;
  };
}

export interface PrepareStorefrontCheckoutInput {
  readonly merchantSlug: string;
  readonly locationId: string;
  readonly cartId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
}

export interface StorefrontCheckoutActions {
  prepare(
    input: PrepareStorefrontCheckoutInput,
  ): Promise<PrepareCheckoutHandoffResponse>;
}

export class StorefrontCheckoutActionError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly requestId?: string;
  readonly details?: StorefrontErrorState["details"];
  readonly retryAfterMs?: number;
  readonly method?: string;
  readonly routeTemplate?: string;

  constructor(error: StorefrontErrorState) {
    super(error.message);
    this.name = "StorefrontCheckoutActionError";
    this.state = error.state;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
    this.retryAfterMs = error.retryAfterMs;
    this.method = error.method;
    this.routeTemplate = error.routeTemplate;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExactIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.trim() === value
  );
}

function requirePrepareInput(
  input: unknown,
): asserts input is PrepareStorefrontCheckoutInput {
  if (
    !isRecord(input) ||
    !isExactIdentifier(input.merchantSlug) ||
    !isExactIdentifier(input.locationId) ||
    !isExactIdentifier(input.cartId) ||
    typeof input.revision !== "number" ||
    !isStorefrontRevision(input.revision)
  ) {
    throw new StorefrontCheckoutActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The checkout prepare request is invalid.",
    });
  }
  if (
    typeof input.idempotencyKey !== "string" ||
    !isStorefrontIdempotencyKey(input.idempotencyKey)
  ) {
    throw new StorefrontCheckoutActionError({
      state: "integration-error",
      code: "INVALID_IDEMPOTENCY_KEY",
      message: "The checkout prepare request could not be started safely.",
    });
  }
}

function publicPrepareResult(
  result: unknown,
): PrepareCheckoutHandoffResponse {
  if (
    !isRecord(result) ||
    typeof result.checkoutUrl !== "string" ||
    typeof result.expiresAt !== "string"
  ) {
    throw new StorefrontCheckoutActionError({
      state: "integration-error",
      code: "INVALID_PREPARE_RESPONSE",
      message: "The checkout prepare response is invalid.",
    });
  }
  return {
    checkoutUrl: result.checkoutUrl,
    expiresAt: result.expiresAt,
  };
}

async function requireCurrentSession(
  sessionStore: StorefrontSessionStore,
  merchantSlug: string,
  input: PrepareStorefrontCheckoutInput,
): Promise<StorefrontCartSession> {
  let session: StorefrontCartSession | null;
  try {
    session = await sessionStore.get(input.locationId);
  } catch {
    throw new StorefrontCheckoutActionError({
      state: "integration-error",
      code: "SESSION_READ_FAILED",
      message: "The checkout session could not be read safely.",
    });
  }
  if (
    !session ||
    session.merchantSlug !== merchantSlug ||
    session.locationId !== input.locationId ||
    session.cartId !== input.cartId
  ) {
    throw new StorefrontCheckoutActionError({
      state: "access-denied",
      code: "CART_SESSION_MISMATCH",
      message: "This checkout session is no longer available.",
    });
  }
  if (!session.accessToken) {
    throw new StorefrontCheckoutActionError({
      state: "access-denied",
      code: "CART_CAPABILITY_REQUIRED",
      message: "This checkout session is no longer authorized.",
    });
  }
  if (session.revision !== input.revision) {
    throw new StorefrontCheckoutActionError({
      state: "cart-conflict",
      code: "CART_CONFLICT",
      message: "The cart changed. Refresh and retry checkout.",
    });
  }
  return session;
}

export function createStorefrontCheckoutActions(
  client: StorefrontCheckoutClient,
  merchantSlug: string,
  sessionStore: StorefrontSessionStore,
): StorefrontCheckoutActions {
  if (!isExactIdentifier(merchantSlug)) {
    throw new TypeError("Storefront checkout merchant scope is invalid.");
  }
  return {
    async prepare(input) {
      requirePrepareInput(input);
      if (input.merchantSlug !== merchantSlug) {
        throw new StorefrontCheckoutActionError({
          state: "access-denied",
          code: "MERCHANT_SCOPE_MISMATCH",
          message: "The checkout request is outside the active merchant.",
        });
      }
      await requireCurrentSession(sessionStore, merchantSlug, input);
      try {
        const result = await client.checkout.prepare(
          input.locationId,
          input.cartId,
          {
            revision: input.revision,
            idempotencyKey: input.idempotencyKey,
          },
        );
        return publicPrepareResult(result);
      } catch (error) {
        throw error instanceof StorefrontCheckoutActionError
          ? error
          : new StorefrontCheckoutActionError(toStorefrontErrorState(error));
      }
    },
  };
}
