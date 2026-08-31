import type { StorefrontCart, UpdateOrderTimePayload } from "@craveup/storefront-sdk";

import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import {
  StorefrontCartActionError,
  type StorefrontCartActions,
} from "@/lib/storefront/cart-actions";
import { toStorefrontErrorState } from "@/lib/storefront/error-state";
import { StorefrontFulfillmentActionError } from "@/lib/storefront/fulfillment-actions";

import type { OrderTimeState } from "./order-time-picker";

export type OrderTimeRuntime =
  | Readonly<{ mode: "fixture"; runtime: FixtureRuntime }>
  | Readonly<{ mode: "live"; merchantSlug: string }>;

export interface OrderTimeSelectionResult {
  readonly state: OrderTimeState;
  readonly retryAfterSeconds?: number;
  readonly cart?: StorefrontCart;
}

interface OrderTimeAttempt {
  readonly idempotencyKey: string;
  readonly merchantSlug: string;
  readonly locationId: string;
  readonly cartId: string;
  readonly revision: number;
  readonly customerToken: string | null;
  recoveryMode?: "reconcile";
}

const orderTimeAttempts = new Map<string, OrderTimeAttempt>();

function attemptScope(
  merchantSlug: string,
  locationId: string,
  cartId: string,
  payload: UpdateOrderTimePayload,
): string {
  return JSON.stringify([merchantSlug, locationId, cartId, payload]);
}

function errorState(error: unknown): OrderTimeState {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    if (code === "CART_IMMUTABLE") return "immutable";
    if (code === "CART_EXPIRED") return "expired";
    if (code === "CART_CONFLICT") return "conflict";
    if (code === "FULFILLMENT_UNAVAILABLE") return "closed";
  }
  return "error";
}

function fulfillmentErrorState(error: unknown) {
  return error instanceof StorefrontFulfillmentActionError ||
    error instanceof StorefrontCartActionError
    ? {
        state: error.state,
        code: error.code,
        message: error.message,
        retryAfterMs: error.retryAfterMs,
      }
    : toStorefrontErrorState(error);
}

function cartMatchesOrderTime(
  cart: StorefrontCart,
  payload: UpdateOrderTimePayload,
): boolean {
  if (cart.pickupType !== payload.pickupType) return false;
  if (payload.pickupType === "ASAP") return true;
  return cart.orderDate === payload.orderDate && cart.orderTime === payload.orderTime;
}

export async function updateOrderTime(
  runtime: OrderTimeRuntime,
  locationId: string,
  payload: UpdateOrderTimePayload,
): Promise<OrderTimeSelectionResult> {
  const [sessionModule, customerSessionModule] = await Promise.all([
    import("@/lib/storefront/session-store"),
    import("@/lib/storefront/customer-session"),
  ]);
  const merchantSlug =
    runtime.mode === "fixture"
      ? runtime.runtime.config.merchantSlug
      : runtime.merchantSlug;
  const sessionStore = sessionModule.createMerchantCartSessionStore(merchantSlug);
  const stored = await sessionStore.get(locationId);
  if (!stored) return { state: "expired" };
  for (const [cachedScope, cachedAttempt] of orderTimeAttempts) {
    if (
      cachedAttempt.merchantSlug === merchantSlug &&
      cachedAttempt.locationId === locationId &&
      cachedAttempt.cartId !== stored.cartId
    ) {
      orderTimeAttempts.delete(cachedScope);
    }
  }
  const scope = attemptScope(merchantSlug, locationId, stored.cartId, payload);
  const attempt = orderTimeAttempts.get(scope) ?? {
    idempotencyKey: globalThis.crypto.randomUUID(),
    merchantSlug,
    locationId,
    cartId: stored.cartId,
    revision: stored.revision,
    customerToken: customerSessionModule.getCustomerToken(merchantSlug),
  };
  orderTimeAttempts.set(scope, attempt);

  try {
    let actions;
    let cartActions: StorefrontCartActions;
    let persistFixtureCart:
      | ((cart: StorefrontCart) => void)
      | undefined;
    if (runtime.mode === "fixture") {
      const [{ createFixtureStorefrontActions }, snapshotModule] =
        await Promise.all([
          import("@/fixtures/storefront-actions"),
          import("@/fixtures/cart-snapshot"),
        ]);
      const snapshot = snapshotModule.readFixtureCartSnapshot(
        merchantSlug,
        locationId,
      );
      if (
        !snapshot ||
        snapshot.id !== attempt.cartId ||
        snapshot.revision !== attempt.revision
      ) {
        orderTimeAttempts.delete(scope);
        if (snapshot) {
          await sessionStore.set({
            merchantSlug,
            locationId,
            cartId: snapshot.id,
            revision: snapshot.revision,
          });
        }
        return snapshot
          ? { state: "conflict", cart: snapshot }
          : { state: "expired" };
      }
      const fixtureActions = createFixtureStorefrontActions(runtime.runtime, {
        initialCart: snapshot,
      });
      actions = fixtureActions.fulfillment;
      cartActions = fixtureActions.cart;
      persistFixtureCart = (cart) =>
        snapshotModule.writeFixtureCartSnapshot(merchantSlug, cart);
    } else {
      const [clientModule, actionModule, cartModule] = await Promise.all([
        import("@/lib/storefront/browser-client"),
        import("@/lib/storefront/fulfillment-actions"),
        import("@/lib/storefront/cart-actions"),
      ]);
      const client = clientModule.createBrowserStorefrontClient({
        getAuthToken: () => attempt.customerToken,
        sessionStore,
      });
      actions = actionModule.createStorefrontFulfillmentActions(client);
      cartActions = cartModule.createStorefrontCartActions(client);
    }

    if (attempt.recoveryMode === "reconcile") {
      const refreshed = await cartActions.get({
        locationId,
        cartId: attempt.cartId,
      });
      await sessionStore.set({
        merchantSlug,
        locationId,
        cartId: refreshed.id,
        revision: refreshed.revision,
      });
      persistFixtureCart?.(refreshed);
      if (cartMatchesOrderTime(refreshed, payload)) {
        orderTimeAttempts.delete(scope);
        return { state: "ready", cart: refreshed };
      }
      if (refreshed.revision > attempt.revision) {
        orderTimeAttempts.delete(scope);
        return { state: "conflict", cart: refreshed };
      }
      return { state: "processing", retryAfterSeconds: 1 };
    }

    const result = await actions.updateOrderTime({
      locationId,
      cartId: attempt.cartId,
      revision: attempt.revision,
      idempotencyKey: attempt.idempotencyKey,
      payload,
    });
    await sessionStore.set({
      merchantSlug,
      locationId,
      cartId: result.cart.id,
      revision: result.cart.revision,
    });
    persistFixtureCart?.(result.cart);
    orderTimeAttempts.delete(scope);
    return {
      state: result.state === "retry-required" ? "conflict" : "ready",
      cart: result.cart,
    };
  } catch (error) {
    const safeError = fulfillmentErrorState(error);
    if (safeError.state === "rate-limited") {
      return {
        state: "rate-limited",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((safeError.retryAfterMs ?? 1_000) / 1_000),
        ),
      };
    }
    if (safeError.state === "operation-pending") {
      attempt.recoveryMode = "reconcile";
      return {
        state: "processing",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((safeError.retryAfterMs ?? 1_000) / 1_000),
        ),
      };
    }
    if (safeError.state === "dependency-unavailable") {
      return { state: "unavailable", retryAfterSeconds: 1 };
    }
    if (
      ![
        "network-error",
        "rate-limited",
        "dependency-unavailable",
        "operation-pending",
      ].includes(safeError.state)
    ) {
      orderTimeAttempts.delete(scope);
    }
    return { state: errorState(error) };
  }
}

export function clearOrderTimeRuntimeCacheForTests(): void {
  orderTimeAttempts.clear();
}
