import type {
  RequestConfig,
  StorefrontCart,
  UpdateGratuityPayload,
} from "@craveup/storefront-sdk";

import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "./action-input";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";

export interface StorefrontCheckoutAdjustmentClient {
  readonly cart: {
    get(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    updateGratuity(
      locationId: string,
      cartId: string,
      payload: UpdateGratuityPayload,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    applyDiscount(
      locationId: string,
      cartId: string,
      code: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    removeDiscount(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
  };
}

interface MutationIdentity {
  readonly locationId: string;
  readonly cartId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
}

export interface UpdateStorefrontGratuityInput extends MutationIdentity {
  readonly payload: UpdateGratuityPayload;
}

export interface ApplyStorefrontDiscountInput extends MutationIdentity {
  readonly code: string;
}

export type StorefrontCheckoutAdjustmentResult =
  | Readonly<{ state: "succeeded"; cart: StorefrontCart }>
  | Readonly<{
      state: "retry-required";
      cart: StorefrontCart;
      error: StorefrontErrorState;
    }>;

export interface StorefrontCheckoutAdjustmentActions {
  updateGratuity(
    input: UpdateStorefrontGratuityInput,
  ): Promise<StorefrontCheckoutAdjustmentResult>;
  applyDiscount(
    input: ApplyStorefrontDiscountInput,
  ): Promise<StorefrontCheckoutAdjustmentResult>;
  removeDiscount(
    input: MutationIdentity,
  ): Promise<StorefrontCheckoutAdjustmentResult>;
}

export class StorefrontCheckoutAdjustmentError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly retryAfterMs?: number;
  readonly cart?: StorefrontCart;

  constructor(error: StorefrontErrorState, cart?: StorefrontCart) {
    super(error.message);
    this.name = "StorefrontCheckoutAdjustmentError";
    this.state = error.state;
    this.code = error.code;
    this.retryAfterMs = error.retryAfterMs;
    this.cart = cart;
  }
}

function requireIdentity(input: MutationIdentity) {
  if (
    !input.locationId.trim() ||
    !input.cartId.trim() ||
    !isStorefrontRevision(input.revision) ||
    !isStorefrontIdempotencyKey(input.idempotencyKey)
  ) {
    throw new StorefrontCheckoutAdjustmentError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The checkout adjustment request is invalid.",
    });
  }
}

function requireDecimal(value: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new StorefrontCheckoutAdjustmentError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The gratuity selection is invalid.",
    });
  }
}

function integrationError(code: string, message: string) {
  return new StorefrontCheckoutAdjustmentError({
    state: "integration-error",
    code,
    message,
  });
}

function assertCartScope(input: MutationIdentity, cart: StorefrontCart): void {
  if (cart.id !== input.cartId || cart.locationId !== input.locationId) {
    throw integrationError(
      "CART_SCOPE_MISMATCH",
      "The checkout response does not match this ordering session.",
    );
  }
  if (!isStorefrontRevision(cart.revision)) {
    throw integrationError(
      "CART_REVISION_INVALID",
      "The checkout response has an invalid cart revision.",
    );
  }
}

function assertMutationCart(input: MutationIdentity, cart: StorefrontCart): void {
  assertCartScope(input, cart);
  if (cart.revision <= input.revision) {
    throw integrationError(
      "CART_REVISION_NOT_ADVANCED",
      "The checkout response did not advance the cart revision.",
    );
  }
}

function assertRefreshedCart(input: MutationIdentity, cart: StorefrontCart): void {
  assertCartScope(input, cart);
  if (cart.revision < input.revision) {
    throw integrationError(
      "CART_REVISION_REGRESSED",
      "The refreshed checkout cart is stale.",
    );
  }
}

export function createStorefrontCheckoutAdjustmentActions(
  client: StorefrontCheckoutAdjustmentClient,
): StorefrontCheckoutAdjustmentActions {
  async function mutate(
    input: MutationIdentity,
    operation: () => Promise<StorefrontCart>,
  ): Promise<StorefrontCheckoutAdjustmentResult> {
    requireIdentity(input);
    let cart: StorefrontCart;
    try {
      cart = await operation();
    } catch (error) {
      const safeError = toStorefrontErrorState(error);
      if (safeError.code !== "CART_CONFLICT") {
        throw new StorefrontCheckoutAdjustmentError(safeError);
      }
      let refreshed: StorefrontCart;
      try {
        refreshed = await client.cart.get(input.locationId, input.cartId);
      } catch {
        throw new StorefrontCheckoutAdjustmentError(safeError);
      }
      assertRefreshedCart(input, refreshed);
      return { state: "retry-required", cart: refreshed, error: safeError };
    }
    assertMutationCart(input, cart);
    return { state: "succeeded", cart };
  }

  return {
    async updateGratuity(input) {
      const value = input.payload.percentage ?? input.payload.amount;
      if (typeof value !== "string") {
        throw new StorefrontCheckoutAdjustmentError({
          state: "validation",
          code: "VALIDATION_ERROR",
          message: "The gratuity selection is invalid.",
        });
      }
      requireDecimal(value);
      return mutate(input, () =>
        client.cart.updateGratuity(
          input.locationId,
          input.cartId,
          input.payload,
          {
            revision: input.revision,
            idempotencyKey: input.idempotencyKey,
          },
        ),
      );
    },
    async applyDiscount(input) {
      if (!input.code.trim() || input.code.trim() !== input.code) {
        throw new StorefrontCheckoutAdjustmentError({
          state: "validation",
          code: "VALIDATION_ERROR",
          message: "The discount code is invalid.",
        });
      }
      return mutate(input, () =>
        client.cart.applyDiscount(input.locationId, input.cartId, input.code, {
          revision: input.revision,
          idempotencyKey: input.idempotencyKey,
        }),
      );
    },
    async removeDiscount(input) {
      return mutate(input, () =>
        client.cart.removeDiscount(input.locationId, input.cartId, {
          revision: input.revision,
          idempotencyKey: input.idempotencyKey,
        }),
      );
    },
  };
}
