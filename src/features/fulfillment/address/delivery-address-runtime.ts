import type { DeliveryAddress, StorefrontCart } from "@craveup/storefront-sdk";

import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import type { StorefrontCartActions } from "@/lib/storefront/cart-actions";
import { storefrontCartReadIssue } from "@/lib/storefront/cart-response";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "@/lib/storefront/error-state";
import { StorefrontFulfillmentActionError } from "@/lib/storefront/fulfillment-actions";

export type DeliveryAddressRuntime =
  | Readonly<{ mode: "fixture"; runtime: FixtureRuntime }>
  | Readonly<{ mode: "live"; merchantSlug: string }>;

export type ApplyDeliveryAddressResult =
  | Readonly<{ state: "succeeded"; cart: StorefrontCart }>
  | Readonly<{
      state: "retry-required";
      cart: StorefrontCart;
      error: StorefrontErrorState;
    }>;

interface DeliveryAttempt {
  readonly cartId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
  readonly signature: string;
  recoveryMode?: "reconcile";
}

const deliveryAttempts = new Map<string, DeliveryAttempt>();

function fulfillmentErrorState(error: unknown) {
  return error instanceof StorefrontFulfillmentActionError
    ? {
        state: error.state,
        code: error.code,
        message: error.message,
        retryAfterMs: error.retryAfterMs,
      }
    : toStorefrontErrorState(error);
}

function addressMatches(cart: StorefrontCart, address: DeliveryAddress) {
  const current = cart.deliveryInfo?.addressData;
  return (
    cart.fulfilmentMethod === "delivery" &&
    current?.street === address.street &&
    current.streetOptional === address.streetOptional &&
    current.city === address.city &&
    current.state === address.state &&
    current.zipCode === address.zipCode &&
    current.country === address.country &&
    current.lat === address.lat &&
    current.lng === address.lng
  );
}

export async function applyDeliveryAddress(
  runtime: DeliveryAddressRuntime,
  locationId: string,
  address: DeliveryAddress,
): Promise<ApplyDeliveryAddressResult> {
  const sessionModule = await import("@/lib/storefront/session-store");
  const merchantSlug =
    runtime.mode === "fixture"
      ? runtime.runtime.config.merchantSlug
      : runtime.merchantSlug;
  sessionModule.setActiveStorefrontMerchant(merchantSlug);
  const stored = await sessionModule.browserCartSessionStore.get(locationId);
  if (!stored) {
    const { StorefrontFulfillmentActionError } = await import(
      "@/lib/storefront/fulfillment-actions"
    );
    throw new StorefrontFulfillmentActionError({
      state: "unavailable",
      code: "CART_EXPIRED",
      message: "The ordering session is no longer available.",
    });
  }
  const scope = JSON.stringify([merchantSlug, locationId, stored.cartId]);
  const signature = JSON.stringify(address);
  const attempt = deliveryAttempts.get(scope) ?? {
    cartId: stored.cartId,
    revision: stored.revision,
    idempotencyKey: globalThis.crypto.randomUUID(),
    signature,
  };
  if (attempt.signature !== signature) {
    throw new StorefrontFulfillmentActionError({
      state: "operation-pending",
      code: "IDEMPOTENCY_IN_PROGRESS",
      message: "Finish checking the previous delivery address before starting another.",
    });
  }
  if (attempt.cartId !== stored.cartId || attempt.revision !== stored.revision) {
    deliveryAttempts.delete(scope);
    throw new StorefrontFulfillmentActionError({
      state: "cart-conflict",
      code: "CART_CONFLICT",
      message: "The cart changed. Review it before retrying the address.",
    });
  }
  deliveryAttempts.set(scope, attempt);

  let actions;
  let cartActions: StorefrontCartActions;
  let persistFixtureCart: ((cart: StorefrontCart) => void) | undefined;
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
      snapshot.id !== stored.cartId ||
      snapshot.revision !== stored.revision
    ) {
      deliveryAttempts.delete(scope);
      if (snapshot) {
        await sessionModule.browserCartSessionStore.set({
          merchantSlug,
          locationId,
          cartId: snapshot.id,
          revision: snapshot.revision,
        });
      }
      const { StorefrontFulfillmentActionError } = await import(
        "@/lib/storefront/fulfillment-actions"
      );
      throw new StorefrontFulfillmentActionError({
        state: snapshot ? "cart-conflict" : "unavailable",
        code: snapshot ? "CART_CONFLICT" : "CART_EXPIRED",
        message: snapshot
          ? "The cart changed. Review it before setting delivery."
          : "The ordering session is no longer available.",
      });
    }
    const fixtureActions = createFixtureStorefrontActions(runtime.runtime, {
      initialCart: snapshot,
    });
    actions = fixtureActions.fulfillment;
    cartActions = fixtureActions.cart;
    persistFixtureCart = (cart) =>
      snapshotModule.writeFixtureCartSnapshot(merchantSlug, cart);
  } else {
    const [{ storefrontClient }, actionModule, cartModule] = await Promise.all([
      import("@/lib/storefront/browser-client"),
      import("@/lib/storefront/fulfillment-actions"),
      import("@/lib/storefront/cart-actions"),
    ]);
    actions = actionModule.createStorefrontFulfillmentActions(storefrontClient);
    cartActions = cartModule.createStorefrontCartActions(storefrontClient);
  }

  const persist = async (cart: StorefrontCart) => {
    await sessionModule.browserCartSessionStore.set({
      merchantSlug,
      locationId,
      cartId: cart.id,
      revision: cart.revision,
    });
    persistFixtureCart?.(cart);
  };

  if (attempt.recoveryMode === "reconcile") {
    let refreshed: StorefrontCart;
    try {
      refreshed = await cartActions.get({
        locationId,
        cartId: attempt.cartId,
      });
    } catch (error) {
      const safe = fulfillmentErrorState(error);
      if (
        ![
          "network-error",
          "rate-limited",
          "dependency-unavailable",
          "operation-pending",
        ].includes(safe.state)
      ) {
        deliveryAttempts.delete(scope);
      }
      throw error;
    }
    const issue = storefrontCartReadIssue(
      { locationId, cartId: attempt.cartId, revision: attempt.revision },
      refreshed,
    );
    if (issue) {
      deliveryAttempts.delete(scope);
      throw new StorefrontFulfillmentActionError({
        state: "integration-error",
        ...issue,
      });
    }
    await persist(refreshed);
    if (addressMatches(refreshed, address)) {
      deliveryAttempts.delete(scope);
      return { state: "succeeded", cart: refreshed };
    }
    if (refreshed.revision === attempt.revision) {
      throw new StorefrontFulfillmentActionError({
        state: "operation-pending",
        code: "IDEMPOTENCY_IN_PROGRESS",
        message: "The delivery address update is still processing.",
        retryAfterMs: 1_000,
      });
    }
    deliveryAttempts.delete(scope);
    return {
      state: "retry-required",
      cart: refreshed,
      error: {
        state: "cart-conflict",
        code: "CART_CONFLICT",
        message: "The cart changed while the address was processing.",
      },
    };
  }

  try {
    const result = await actions.setDelivery({
      locationId,
      cartId: attempt.cartId,
      revision: attempt.revision,
      idempotencyKey: attempt.idempotencyKey,
      address,
    });
    await persist(result.cart);
    deliveryAttempts.delete(scope);
    return result;
  } catch (error) {
    const safe = fulfillmentErrorState(error);
    if (safe.state === "operation-pending") {
      attempt.recoveryMode = "reconcile";
    } else if (
      safe.state !== "network-error"
    ) {
      deliveryAttempts.delete(scope);
    }
    throw error;
  }
}

export function clearDeliveryAddressRuntimeCacheForTests(): void {
  deliveryAttempts.clear();
}
