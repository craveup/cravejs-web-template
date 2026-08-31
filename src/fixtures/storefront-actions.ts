import type { StorefrontCart } from "@craveup/storefront-sdk";

import type { StorefrontLoyaltyActions } from "../features/loyalty/loyalty-actions";
import {
  StorefrontCartActionError,
  type StorefrontAddItemResult,
  type StorefrontCartActions,
  type StorefrontDeleteCartResult,
  type StorefrontCartItemMutationResult,
} from "../lib/storefront/cart-actions";
import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "../lib/storefront/action-input";
import {
  StorefrontOrderingSessionError,
  type StorefrontOrderingSessionActions,
  type StorefrontOrderingSessionResult,
} from "../lib/storefront/ordering-session";
import { fixtureEmptyCart } from "./cart";
import {
  StorefrontFulfillmentActionError,
  type StorefrontFulfillmentActions,
  type StorefrontFulfillmentMutationResult,
} from "../lib/storefront/fulfillment-actions";
import {
  addFixtureCartItem,
  changeFixtureFulfillmentMethod,
  expireFixtureCart,
  removeFixtureCartItem,
  updateFixtureCartItemQuantity,
} from "./cart-authority";
import type { FixtureRuntime } from "./fixture-runtime";
import { fixtureLocation } from "./location";
import { createFixtureStorefrontLoyaltyActions } from "./loyalty-actions";

export interface FixtureStorefrontActions {
  readonly orderingSession: StorefrontOrderingSessionActions;
  readonly fulfillment: StorefrontFulfillmentActions;
  readonly cart: StorefrontCartActions;
  readonly loyalty: StorefrontLoyaltyActions;
}

export interface FixtureStorefrontActionOptions {
  readonly initialCart?: StorefrontCart;
}

function assertFixtureScope(
  runtime: FixtureRuntime,
  merchantSlug: string,
  locationId: string,
): void {
  if (
    merchantSlug !== runtime.config.merchantSlug ||
    locationId !== fixtureLocation.id
  ) {
    throw new StorefrontOrderingSessionError({
      state: "access-denied",
      code: "FIXTURE_SCOPE_MISMATCH",
      message: "The fixture ordering session is outside the active tenant.",
    });
  }
}

function assertFixtureCartInput(input: {
  readonly locationId: string;
  readonly cartId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
}): void {
  if (
    input.locationId !== fixtureLocation.id ||
    !input.cartId ||
    !isStorefrontRevision(input.revision)
  ) {
    throw new StorefrontCartActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The fixture cart request is invalid.",
    });
  }
  if (!isStorefrontIdempotencyKey(input.idempotencyKey)) {
    throw new StorefrontCartActionError({
      state: "integration-error",
      code: "INVALID_IDEMPOTENCY_KEY",
      message: "The fixture cart request could not be started safely.",
    });
  }
}

function fixtureIdempotencyReuseError(): StorefrontCartActionError {
  return new StorefrontCartActionError({
    state: "integration-error",
    code: "IDEMPOTENCY_KEY_REUSED",
    message: "The fixture idempotency key belongs to another request.",
  });
}

export function createFixtureStorefrontActions(
  runtime: FixtureRuntime,
  options: FixtureStorefrontActionOptions = {},
): FixtureStorefrontActions {
  let currentCart: StorefrontCart = structuredClone(
    options.initialCart ?? fixtureEmptyCart,
  );
  const addAttempts = new Map<
    string,
    Readonly<{ fingerprint: string; result: StorefrontAddItemResult }>
  >();
  const deleteAttempts = new Map<
    string,
    Readonly<{ fingerprint: string; result: StorefrontDeleteCartResult }>
  >();
  const quantityAttempts = new Map<
    string,
    Readonly<{ fingerprint: string; result: StorefrontCartItemMutationResult }>
  >();
  const removeAttempts = new Map<
    string,
    Readonly<{ fingerprint: string; result: StorefrontCartItemMutationResult }>
  >();
  const sessionAttempts = new Map<
    string,
    Readonly<{
      fingerprint: string;
      result: StorefrontOrderingSessionResult;
    }>
  >();
  const tableAttempts = new Map<
    string,
    Readonly<{
      fingerprint: string;
      result: StorefrontFulfillmentMutationResult;
    }>
  >();
  const deliveryAttempts = new Map<
    string,
    Readonly<{
      fingerprint: string;
      result: StorefrontFulfillmentMutationResult;
    }>
  >();
  const roomAttempts = new Map<
    string,
    Readonly<{
      fingerprint: string;
      result: StorefrontFulfillmentMutationResult;
    }>
  >();
  const orderTimeAttempts = new Map<
    string,
    Readonly<{
      fingerprint: string;
      result: StorefrontFulfillmentMutationResult;
    }>
  >();

  function keyUsedByAnotherMutation(
    idempotencyKey: string,
    own: Map<string, unknown>,
  ): boolean {
    return [
      addAttempts,
      deleteAttempts,
      quantityAttempts,
      removeAttempts,
      deliveryAttempts,
      tableAttempts,
      roomAttempts,
      orderTimeAttempts,
    ]
      .some((attempts) => attempts !== own && attempts.has(idempotencyKey));
  }

  return {
    loyalty: createFixtureStorefrontLoyaltyActions(runtime),
    orderingSession: {
      async start(input) {
        assertFixtureScope(runtime, input.merchantSlug, input.locationId);
        if (!isStorefrontIdempotencyKey(input.idempotencyKey)) {
          throw new StorefrontOrderingSessionError({
            state: "integration-error",
            code: "INVALID_IDEMPOTENCY_KEY",
            message: "The fixture ordering session could not be started safely.",
          });
        }
        const fingerprint = JSON.stringify({
          merchantSlug: input.merchantSlug,
          locationId: input.locationId,
          fulfillmentMethod: input.fulfillmentMethod,
          channel: input.channel,
          existingCart: input.existingCart,
          includeCustomerContext: input.includeCustomerContext ?? false,
        });
        const cached = sessionAttempts.get(input.idempotencyKey);
        if (cached) {
          if (cached.fingerprint !== fingerprint) {
            throw new StorefrontOrderingSessionError({
              state: "integration-error",
              code: "IDEMPOTENCY_KEY_REUSED",
              message:
                "The fixture idempotency key belongs to another request.",
            });
          }
          return cached.result;
        }
        if (
          input.existingCart &&
          (input.existingCart.cartId !== currentCart.id ||
            input.existingCart.revision !== currentCart.revision)
        ) {
          throw new StorefrontOrderingSessionError({
            state: "cart-conflict",
            code: "CART_CONFLICT",
            message: "The fixture cart changed. Refresh and retry.",
          });
        }

        if (currentCart.fulfilmentMethod !== input.fulfillmentMethod) {
          currentCart = changeFixtureFulfillmentMethod(
            currentCart,
            input.fulfillmentMethod,
          );
        }

        const result = {
          cart: currentCart,
          resumed: input.existingCart !== undefined,
        };
        sessionAttempts.set(input.idempotencyKey, { fingerprint, result });
        return result;
      },
    },
    fulfillment: {
      async setDelivery(input) {
        assertFixtureCartInput(input);
        const { address } = input;
        if (
          !address.street?.trim() ||
          !address.city?.trim() ||
          !address.state?.trim() ||
          !address.zipCode?.trim() ||
          !Number.isFinite(address.lat) ||
          !Number.isFinite(address.lng)
        ) {
          throw new StorefrontFulfillmentActionError({
            state: "validation",
            code: "VALIDATION_ERROR",
            message: "The fixture delivery address is invalid.",
          });
        }
        if (keyUsedByAnotherMutation(input.idempotencyKey, deliveryAttempts)) {
          throw fixtureIdempotencyReuseError();
        }
        const fingerprint = JSON.stringify(input);
        const cached = deliveryAttempts.get(input.idempotencyKey);
        if (cached) {
          if (cached.fingerprint !== fingerprint) throw fixtureIdempotencyReuseError();
          return cached.result;
        }
        if (input.cartId !== currentCart.id || input.revision !== currentCart.revision) {
          const result = {
            state: "retry-required",
            cart: currentCart,
            error: {
              state: "cart-conflict",
              code: "CART_CONFLICT",
              message: "The fixture cart changed. Refresh and retry.",
            },
          } as const;
          deliveryAttempts.set(input.idempotencyKey, { fingerprint, result });
          return result;
        }
        const addressString = [
          address.street,
          address.streetOptional,
          address.city,
          address.state,
          address.zipCode,
        ].filter(Boolean).join(", ");
        currentCart = {
          ...currentCart,
          fulfilmentMethod: "delivery",
          fulfillmentIdentifier: addressString,
          deliveryInfo: { addressString, addressData: address },
          tableServiceInfo: null,
          roomServiceInfo: null,
          revision: currentCart.revision + 1,
        };
        const result = { state: "succeeded", cart: currentCart } as const;
        deliveryAttempts.set(input.idempotencyKey, { fingerprint, result });
        return result;
      },
      async setTable(input) {
        assertFixtureCartInput(input);
        if (!input.tableNumber || input.tableNumber.trim() !== input.tableNumber) {
          throw new StorefrontFulfillmentActionError({
            state: "validation",
            code: "VALIDATION_ERROR",
            message: "The fixture table number is invalid.",
          });
        }
        if (keyUsedByAnotherMutation(input.idempotencyKey, tableAttempts)) {
          throw fixtureIdempotencyReuseError();
        }
        const fingerprint = JSON.stringify(input);
        const cached = tableAttempts.get(input.idempotencyKey);
        if (cached) {
          if (cached.fingerprint !== fingerprint) {
            throw new StorefrontFulfillmentActionError({
              state: "integration-error",
              code: "IDEMPOTENCY_KEY_REUSED",
              message: "The fixture idempotency key belongs to another request.",
            });
          }
          return cached.result;
        }
        if (
          input.cartId !== currentCart.id ||
          input.revision !== currentCart.revision
        ) {
          const result = {
            state: "retry-required",
            cart: currentCart,
            error: {
              state: "cart-conflict",
              code: "CART_CONFLICT",
              message: "The fixture cart changed. Refresh and retry.",
            },
          } as const;
          tableAttempts.set(input.idempotencyKey, { fingerprint, result });
          return result;
        }

        currentCart = {
          ...currentCart,
          fulfilmentMethod: "table_side",
          fulfillmentIdentifier: input.tableNumber,
          deliveryInfo: null,
          tableServiceInfo: { tableNumber: input.tableNumber },
          roomServiceInfo: null,
          revision: currentCart.revision + 1,
        };
        const result = { state: "succeeded", cart: currentCart } as const;
        tableAttempts.set(input.idempotencyKey, { fingerprint, result });
        return result;
      },
      async setRoom(input) {
        assertFixtureCartInput(input);
        if (
          !input.detail.roomNumber ||
          input.detail.roomNumber.trim() !== input.detail.roomNumber ||
          !input.detail.lastName ||
          input.detail.lastName.trim() !== input.detail.lastName
        ) {
          throw new StorefrontFulfillmentActionError({
            state: "validation",
            code: "VALIDATION_ERROR",
            message: "The fixture room details are invalid.",
          });
        }
        if (keyUsedByAnotherMutation(input.idempotencyKey, roomAttempts)) {
          throw fixtureIdempotencyReuseError();
        }
        const fingerprint = JSON.stringify(input);
        const cached = roomAttempts.get(input.idempotencyKey);
        if (cached) {
          if (cached.fingerprint !== fingerprint) throw fixtureIdempotencyReuseError();
          return cached.result;
        }
        if (input.cartId !== currentCart.id || input.revision !== currentCart.revision) {
          const result = {
            state: "retry-required",
            cart: currentCart,
            error: {
              state: "cart-conflict",
              code: "CART_CONFLICT",
              message: "The fixture cart changed. Refresh and retry.",
            },
          } as const;
          roomAttempts.set(input.idempotencyKey, { fingerprint, result });
          return result;
        }
        currentCart = {
          ...currentCart,
          fulfilmentMethod: "room_service",
          fulfillmentIdentifier: input.detail.roomNumber,
          deliveryInfo: null,
          tableServiceInfo: null,
          roomServiceInfo: input.detail,
          revision: currentCart.revision + 1,
        };
        const result = { state: "succeeded", cart: currentCart } as const;
        roomAttempts.set(input.idempotencyKey, { fingerprint, result });
        return result;
      },
      async updateOrderTime(input) {
        assertFixtureCartInput(input);
        const fingerprint = JSON.stringify(input);
        const cached = orderTimeAttempts.get(input.idempotencyKey);
        if (cached) {
          if (cached.fingerprint !== fingerprint) {
            throw new StorefrontFulfillmentActionError({
              state: "integration-error",
              code: "IDEMPOTENCY_KEY_REUSED",
              message: "The fixture idempotency key belongs to another request.",
            });
          }
          return cached.result;
        }
        if (
          input.cartId !== currentCart.id ||
          input.revision !== currentCart.revision
        ) {
          const result = {
            state: "retry-required",
            cart: currentCart,
            error: {
              state: "cart-conflict",
              code: "CART_CONFLICT",
              message: "The fixture cart changed. Refresh and retry.",
            },
          } as const;
          orderTimeAttempts.set(input.idempotencyKey, { fingerprint, result });
          return result;
        }

        currentCart = {
          ...currentCart,
          pickupType: input.payload.pickupType,
          orderDate:
            input.payload.pickupType === "LATER"
              ? input.payload.orderDate
              : currentCart.orderDate,
          orderTime:
            input.payload.pickupType === "LATER"
              ? input.payload.orderTime
              : currentCart.orderTime,
          revision: currentCart.revision + 1,
        };
        const result = { state: "succeeded", cart: currentCart } as const;
        orderTimeAttempts.set(input.idempotencyKey, { fingerprint, result });
        return result;
      },
    },
    cart: {
      async get(input) {
        if (
          input.locationId !== fixtureLocation.id ||
          input.cartId !== currentCart.id
        ) {
          throw new StorefrontCartActionError({
            state: "validation",
            code: "VALIDATION_ERROR",
            message: "The fixture cart request is invalid.",
          });
        }
        return currentCart;
      },
      async addItem(input) {
        assertFixtureCartInput(input);
        if (keyUsedByAnotherMutation(input.idempotencyKey, addAttempts)) {
          throw fixtureIdempotencyReuseError();
        }
        const fingerprint = JSON.stringify({
          locationId: input.locationId,
          cartId: input.cartId,
          revision: input.revision,
          payload: input.payload,
        });
        const cached = addAttempts.get(input.idempotencyKey);
        if (cached) {
          if (cached.fingerprint !== fingerprint) {
            throw fixtureIdempotencyReuseError();
          }
          return cached.result;
        }
        if (
          input.cartId !== currentCart.id ||
          input.revision !== currentCart.revision
        ) {
          return {
            state: "retry-required",
            cart: currentCart,
            error: {
              state: "cart-conflict",
              code: "CART_CONFLICT",
              message: "The fixture cart changed. Refresh and retry.",
            },
          };
        }

        currentCart = addFixtureCartItem(currentCart, input.payload);
        const result = { state: "succeeded", cart: currentCart } as const;
        addAttempts.set(input.idempotencyKey, { fingerprint, result });
        return result;
      },
      async updateItemQuantity(input) {
        assertFixtureCartInput(input);
        if (
          !input.itemId ||
          !Number.isSafeInteger(input.quantity) ||
          input.quantity < 1
        ) {
          throw new StorefrontCartActionError({
            state: "validation",
            code: "VALIDATION_ERROR",
            message: "The fixture cart item quantity is invalid.",
          });
        }
        if (keyUsedByAnotherMutation(input.idempotencyKey, quantityAttempts)) {
          throw fixtureIdempotencyReuseError();
        }
        const fingerprint = JSON.stringify({
          locationId: input.locationId,
          cartId: input.cartId,
          revision: input.revision,
          itemId: input.itemId,
          quantity: input.quantity,
        });
        const cached = quantityAttempts.get(input.idempotencyKey);
        if (cached) {
          if (cached.fingerprint !== fingerprint) {
            throw fixtureIdempotencyReuseError();
          }
          return cached.result;
        }
        if (
          input.cartId !== currentCart.id ||
          input.revision !== currentCart.revision
        ) {
          return {
            state: "retry-required",
            cart: currentCart,
            error: {
              state: "cart-conflict",
              code: "CART_CONFLICT",
              message: "The fixture cart changed. Refresh and retry.",
            },
          };
        }
        currentCart = updateFixtureCartItemQuantity(
          currentCart,
          input.itemId,
          input.quantity,
        );
        const result = { state: "succeeded", cart: currentCart } as const;
        quantityAttempts.set(input.idempotencyKey, { fingerprint, result });
        return result;
      },
      async removeItem(input) {
        assertFixtureCartInput(input);
        if (!input.itemId) {
          throw new StorefrontCartActionError({
            state: "validation",
            code: "VALIDATION_ERROR",
            message: "The fixture cart item is invalid.",
          });
        }
        if (keyUsedByAnotherMutation(input.idempotencyKey, removeAttempts)) {
          throw fixtureIdempotencyReuseError();
        }
        const fingerprint = JSON.stringify({
          locationId: input.locationId,
          cartId: input.cartId,
          revision: input.revision,
          itemId: input.itemId,
        });
        const cached = removeAttempts.get(input.idempotencyKey);
        if (cached) {
          if (cached.fingerprint !== fingerprint) {
            throw fixtureIdempotencyReuseError();
          }
          return cached.result;
        }
        if (
          input.cartId !== currentCart.id ||
          input.revision !== currentCart.revision
        ) {
          return {
            state: "retry-required",
            cart: currentCart,
            error: {
              state: "cart-conflict",
              code: "CART_CONFLICT",
              message: "The fixture cart changed. Refresh and retry.",
            },
          };
        }

        currentCart = removeFixtureCartItem(currentCart, input.itemId);
        const result = { state: "succeeded", cart: currentCart } as const;
        removeAttempts.set(input.idempotencyKey, { fingerprint, result });
        return result;
      },
      async delete(input) {
        assertFixtureCartInput(input);
        if (keyUsedByAnotherMutation(input.idempotencyKey, deleteAttempts)) {
          throw fixtureIdempotencyReuseError();
        }
        const fingerprint = JSON.stringify({
          locationId: input.locationId,
          cartId: input.cartId,
          revision: input.revision,
        });
        const cached = deleteAttempts.get(input.idempotencyKey);
        if (cached) {
          if (cached.fingerprint !== fingerprint) {
            throw fixtureIdempotencyReuseError();
          }
          return cached.result;
        }
        if (
          input.cartId !== currentCart.id ||
          input.revision !== currentCart.revision
        ) {
          return {
            state: "retry-required",
            cart: currentCart,
            error: {
              state: "cart-conflict",
              code: "CART_CONFLICT",
              message: "The fixture cart changed. Refresh and retry.",
            },
          };
        }

        currentCart = expireFixtureCart(currentCart);
        const result = { state: "deleted", cart: currentCart } as const;
        deleteAttempts.set(input.idempotencyKey, { fingerprint, result });
        return result;
      },
    },
  };
}
