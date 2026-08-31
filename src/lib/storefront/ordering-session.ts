import type {
  FulfilmentMethod,
  RequestConfig,
  StartOrderingSessionRequest,
  StartOrderingSessionResponse,
  StorefrontCart,
  StorefrontSessionStore,
} from "@craveup/storefront-sdk";

import { isStorefrontIdempotencyKey } from "./action-input";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";
import { setActiveStorefrontMerchant } from "./session-store";

interface StorefrontOrderingSessionClient {
  readonly orderingSessions: {
    start(
      locationId: string,
      payload: StartOrderingSessionRequest,
      config?: RequestConfig,
    ): Promise<StartOrderingSessionResponse>;
  };
}

export interface StartStorefrontOrderingSessionInput {
  readonly merchantSlug: string;
  readonly locationId: string;
  readonly fulfillmentMethod: FulfilmentMethod;
  readonly channel: NonNullable<StartOrderingSessionRequest["channel"]>;
  readonly idempotencyKey: string;
  readonly existingCart?: Readonly<{ cartId: string; revision: number }>;
  readonly includeCustomerContext?: boolean;
}

export interface StorefrontOrderingSessionResult {
  readonly cart: StorefrontCart;
  readonly resumed: boolean;
}

export interface StorefrontOrderingSessionActions {
  start(
    input: StartStorefrontOrderingSessionInput,
  ): Promise<StorefrontOrderingSessionResult>;
}

export class StorefrontOrderingSessionError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly requestId?: string;
  readonly details?: StorefrontErrorState["details"];
  readonly retryAfterMs?: number;
  readonly method?: string;
  readonly routeTemplate?: string;

  constructor(error: StorefrontErrorState) {
    super(error.message);
    this.name = "StorefrontOrderingSessionError";
    this.state = error.state;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
    this.retryAfterMs = error.retryAfterMs;
    this.method = error.method;
    this.routeTemplate = error.routeTemplate;
  }
}

function persistenceError(): StorefrontOrderingSessionError {
  return new StorefrontOrderingSessionError({
    state: "integration-error",
    code: "SESSION_PERSISTENCE_FAILED",
    message: "The ordering session could not be stored safely.",
  });
}

function assertStartInput(input: StartStorefrontOrderingSessionInput): void {
  if (
    !input.merchantSlug ||
    input.merchantSlug.trim() !== input.merchantSlug ||
    !input.locationId ||
    input.locationId.trim() !== input.locationId ||
    !["takeout", "delivery", "table_side", "room_service"].includes(
      input.fulfillmentMethod,
    ) ||
    !["qr", "web", "kiosk", "app", "pos", "unknown"].includes(
      input.channel,
    ) ||
    (input.existingCart !== undefined &&
      (!input.existingCart.cartId ||
        input.existingCart.cartId.trim() !== input.existingCart.cartId ||
        !Number.isSafeInteger(input.existingCart.revision) ||
        input.existingCart.revision < 0))
  ) {
    throw new StorefrontOrderingSessionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The ordering session request is invalid.",
    });
  }
  if (!isStorefrontIdempotencyKey(input.idempotencyKey)) {
    throw new StorefrontOrderingSessionError({
      state: "integration-error",
      code: "INVALID_IDEMPOTENCY_KEY",
      message: "The ordering session could not be started safely.",
    });
  }
}

export function createStorefrontOrderingSession(
  client: StorefrontOrderingSessionClient,
  sessionStore: StorefrontSessionStore,
  setMerchantScope: (merchantSlug: string) => void =
    setActiveStorefrontMerchant,
): StorefrontOrderingSessionActions {
  return {
    async start(
      input: StartStorefrontOrderingSessionInput,
    ): Promise<StorefrontOrderingSessionResult> {
      assertStartInput(input);
      setMerchantScope(input.merchantSlug);

      const payload: StartOrderingSessionRequest = {
        fulfillmentMethod: input.fulfillmentMethod,
        channel: input.channel,
        ...(input.existingCart
          ? { existingCartId: input.existingCart.cartId }
          : {}),
      };
      const config: RequestConfig = {
        idempotencyKey: input.idempotencyKey,
        ...(input.existingCart
          ? { revision: input.existingCart.revision }
          : {}),
        ...(input.includeCustomerContext
          ? { includeCustomerContext: true }
          : {}),
      };

      let response: StartOrderingSessionResponse;
      try {
        response = await client.orderingSessions.start(
          input.locationId,
          payload,
          config,
        );
      } catch (error) {
        throw new StorefrontOrderingSessionError(
          toStorefrontErrorState(error),
        );
      }

      let stored;
      try {
        stored = await sessionStore.get(input.locationId);
      } catch {
        throw persistenceError();
      }
      if (
        !stored ||
        stored.locationId !== input.locationId ||
        stored.cartId !== response.cart.id ||
        stored.revision < response.cart.revision ||
        (stored.merchantSlug !== undefined &&
          stored.merchantSlug !== input.merchantSlug)
      ) {
        throw persistenceError();
      }

      return {
        cart: response.cart,
        resumed: input.existingCart !== undefined,
      };
    },
  };
}
