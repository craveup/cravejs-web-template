import type {
  DeliveryAddress,
  RequestConfig,
  StorefrontCart,
  UpdateOrderTimePayload,
} from "@craveup/storefront-sdk";

import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "./action-input";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";

interface StorefrontFulfillmentClient {
  readonly cart: {
    get(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    setTable(
      locationId: string,
      cartId: string,
      tableNumber: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    setRoom(
      locationId: string,
      cartId: string,
      payload: StorefrontRoomDetail,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    setDelivery(
      locationId: string,
      cartId: string,
      payload: DeliveryAddress,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    updateOrderTime(
      locationId: string,
      cartId: string,
      payload: UpdateOrderTimePayload,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
  };
}

interface FulfillmentMutationIdentity {
  readonly locationId: string;
  readonly cartId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
}

export interface SetStorefrontTableInput extends FulfillmentMutationIdentity {
  readonly tableNumber: string;
}

export interface SetStorefrontDeliveryInput extends FulfillmentMutationIdentity {
  readonly address: DeliveryAddress;
}

export interface StorefrontRoomDetail {
  readonly lastName: string;
  readonly roomNumber: string;
}

export interface SetStorefrontRoomInput extends FulfillmentMutationIdentity {
  readonly detail: StorefrontRoomDetail;
}

export interface UpdateStorefrontOrderTimeInput
  extends FulfillmentMutationIdentity {
  readonly payload: UpdateOrderTimePayload;
}

export type StorefrontFulfillmentMutationResult =
  | Readonly<{ state: "succeeded"; cart: StorefrontCart }>
  | Readonly<{
      state: "retry-required";
      cart: StorefrontCart;
      error: StorefrontErrorState;
    }>;

export interface StorefrontFulfillmentActions {
  setDelivery(
    input: SetStorefrontDeliveryInput,
  ): Promise<StorefrontFulfillmentMutationResult>;
  setTable(
    input: SetStorefrontTableInput,
  ): Promise<StorefrontFulfillmentMutationResult>;
  setRoom(
    input: SetStorefrontRoomInput,
  ): Promise<StorefrontFulfillmentMutationResult>;
  updateOrderTime(
    input: UpdateStorefrontOrderTimeInput,
  ): Promise<StorefrontFulfillmentMutationResult>;
}

export class StorefrontFulfillmentActionError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly requestId?: string;
  readonly retryAfterMs?: number;

  constructor(error: StorefrontErrorState) {
    super(error.message);
    this.name = "StorefrontFulfillmentActionError";
    this.state = error.state;
    this.code = error.code;
    this.requestId = error.requestId;
    this.retryAfterMs = error.retryAfterMs;
  }
}

function assertMutationIdentity(input: FulfillmentMutationIdentity): void {
  if (
    !input.locationId ||
    input.locationId.trim() !== input.locationId ||
    !input.cartId ||
    input.cartId.trim() !== input.cartId ||
    !isStorefrontRevision(input.revision)
  ) {
    throw new StorefrontFulfillmentActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The fulfillment request is invalid.",
    });
  }
  if (!isStorefrontIdempotencyKey(input.idempotencyKey)) {
    throw new StorefrontFulfillmentActionError({
      state: "integration-error",
      code: "INVALID_IDEMPOTENCY_KEY",
      message: "The fulfillment request could not be started safely.",
    });
  }
}

function assertTableNumber(tableNumber: string): void {
  if (!tableNumber || tableNumber.trim() !== tableNumber) {
    throw new StorefrontFulfillmentActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The table number is invalid.",
    });
  }
}

function assertDeliveryAddress(address: DeliveryAddress): void {
  if (
    !address.street?.trim() ||
    !address.city?.trim() ||
    !address.state?.trim() ||
    !address.zipCode?.trim() ||
    !address.country?.trim() ||
    !Number.isFinite(address.lat) ||
    address.lat < -90 ||
    address.lat > 90 ||
    !Number.isFinite(address.lng) ||
    address.lng < -180 ||
    address.lng > 180
  ) {
    throw new StorefrontFulfillmentActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The delivery address is invalid.",
    });
  }
}

function assertRoomDetail(detail: StorefrontRoomDetail): void {
  if (
    !detail.roomNumber.trim() ||
    detail.roomNumber.trim() !== detail.roomNumber ||
    !detail.lastName.trim() ||
    detail.lastName.trim() !== detail.lastName
  ) {
    throw new StorefrontFulfillmentActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The room details are invalid.",
    });
  }
}

function integrationError(code: string, message: string) {
  return new StorefrontFulfillmentActionError({
    state: "integration-error",
    code,
    message,
  });
}

function assertCartScope(
  input: FulfillmentMutationIdentity,
  cart: StorefrontCart,
): void {
  if (cart.id !== input.cartId || cart.locationId !== input.locationId) {
    throw integrationError(
      "CART_SCOPE_MISMATCH",
      "The fulfillment response does not match this ordering session.",
    );
  }
  if (!isStorefrontRevision(cart.revision)) {
    throw integrationError(
      "CART_REVISION_INVALID",
      "The fulfillment response has an invalid cart revision.",
    );
  }
}

function assertMutationCart(
  input: FulfillmentMutationIdentity,
  cart: StorefrontCart,
): void {
  assertCartScope(input, cart);
  if (cart.revision <= input.revision) {
    throw integrationError(
      "CART_REVISION_NOT_ADVANCED",
      "The fulfillment response did not advance the cart revision.",
    );
  }
}

function assertRefreshedCart(
  input: FulfillmentMutationIdentity,
  cart: StorefrontCart,
): void {
  assertCartScope(input, cart);
  if (cart.revision < input.revision) {
    throw integrationError(
      "CART_REVISION_REGRESSED",
      "The refreshed fulfillment cart is stale.",
    );
  }
}

export function createStorefrontFulfillmentActions(
  client: StorefrontFulfillmentClient,
): StorefrontFulfillmentActions {
  async function mutate(
    input: FulfillmentMutationIdentity,
    action: () => Promise<StorefrontCart>,
  ): Promise<StorefrontFulfillmentMutationResult> {
    assertMutationIdentity(input);
    let cart: StorefrontCart;
    try {
      cart = await action();
    } catch (error) {
      const safeError = toStorefrontErrorState(error);
      if (safeError.code !== "CART_CONFLICT") {
        throw new StorefrontFulfillmentActionError(safeError);
      }
      let refreshed: StorefrontCart;
      try {
        refreshed = await client.cart.get(input.locationId, input.cartId);
      } catch {
        throw new StorefrontFulfillmentActionError(safeError);
      }
      assertRefreshedCart(input, refreshed);
      return { state: "retry-required", cart: refreshed, error: safeError };
    }
    assertMutationCart(input, cart);
    return { state: "succeeded", cart };
  }

  return {
    async setDelivery(input) {
      assertDeliveryAddress(input.address);
      return mutate(input, () =>
        client.cart.setDelivery(input.locationId, input.cartId, input.address, {
          revision: input.revision,
          idempotencyKey: input.idempotencyKey,
        }),
      );
    },
    async setTable(input) {
      assertTableNumber(input.tableNumber);
      return mutate(input, () =>
        client.cart.setTable(input.locationId, input.cartId, input.tableNumber, {
          revision: input.revision,
          idempotencyKey: input.idempotencyKey,
        }),
      );
    },
    async setRoom(input) {
      assertRoomDetail(input.detail);
      return mutate(input, () =>
        client.cart.setRoom(input.locationId, input.cartId, input.detail, {
          revision: input.revision,
          idempotencyKey: input.idempotencyKey,
        }),
      );
    },
    async updateOrderTime(input) {
      return mutate(input, () =>
        client.cart.updateOrderTime(input.locationId, input.cartId, input.payload, {
          revision: input.revision,
          idempotencyKey: input.idempotencyKey,
        }),
      );
    },
  };
}
