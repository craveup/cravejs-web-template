import type {
  StorefrontCart,
  UpdateGratuityPayload,
} from "@craveup/storefront-sdk";

import type { StorefrontLoyaltyRuntimeConfig } from "@/features/loyalty/browser-loyalty-actions";
import type {
  StorefrontLoyaltyMutationResult,
  StorefrontLoyaltyQuoteResult,
} from "@/features/loyalty/loyalty-actions";
import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import {
  StorefrontCheckoutAdjustmentError,
  type StorefrontCheckoutAdjustmentActions,
  type StorefrontCheckoutAdjustmentResult,
} from "@/lib/storefront/checkout-adjustment-actions";
import type { StorefrontCartActions } from "@/lib/storefront/cart-actions";
import { storefrontCartReadIssue } from "@/lib/storefront/cart-response";
import { toStorefrontErrorState } from "@/lib/storefront/error-state";

export type CheckoutAdjustmentRuntime =
  | Readonly<{ mode: "fixture"; runtime: FixtureRuntime }>
  | Readonly<{
      mode: "live";
      merchantSlug: string;
      loyaltyConfig?: StorefrontLoyaltyRuntimeConfig;
    }>;

type Adjustment =
  | Readonly<{ kind: "gratuity"; payload: UpdateGratuityPayload }>
  | Readonly<{ kind: "apply-discount"; code: string }>
  | Readonly<{ kind: "remove-discount" }>;

interface AdjustmentAttempt {
  readonly cart: StorefrontCart;
  readonly idempotencyKey: string;
  readonly signature: string;
  recoveryMode?: "reconcile";
}

const adjustmentAttempts = new Map<string, AdjustmentAttempt>();

function merchantSlug(runtime: CheckoutAdjustmentRuntime) {
  return runtime.mode === "fixture"
    ? runtime.runtime.config.merchantSlug
    : runtime.merchantSlug;
}

function adjustmentScope(
  runtime: CheckoutAdjustmentRuntime,
  cart: StorefrontCart,
) {
  return JSON.stringify([merchantSlug(runtime), cart.locationId, cart.id]);
}

function checkoutErrorState(error: unknown) {
  return error instanceof StorefrontCheckoutAdjustmentError
    ? {
        state: error.state,
        code: error.code,
        message: error.message,
        retryAfterMs: error.retryAfterMs,
      }
    : toStorefrontErrorState(error);
}

function cartMatchesAdjustment(cart: StorefrontCart, adjustment: Adjustment) {
  if (adjustment.kind === "apply-discount") {
    return cart.discountCode === adjustment.code;
  }
  if (adjustment.kind === "remove-discount") {
    return !cart.discountCode;
  }
  if ("percentage" in adjustment.payload) {
    const percentage = adjustment.payload.percentage;
    const expectedRate = (Number(percentage) / 100).toFixed(2);
    return cart.fees.tipRate === expectedRate;
  }
  const amount = adjustment.payload.amount;
  const normalized = Number(amount).toFixed(2);
  return cart.waiterTipTotal === normalized;
}

export function checkoutLoyaltyEnabled(runtime: CheckoutAdjustmentRuntime) {
  return runtime.mode === "fixture"
    ? runtime.runtime.config.capabilities.loyalty
    : runtime.loyaltyConfig?.capabilities.loyalty === true;
}

async function requireCurrentSession(
  runtime: CheckoutAdjustmentRuntime,
  cart: StorefrontCart,
) {
  const sessionModule = await import("@/lib/storefront/session-store");
  const scope = merchantSlug(runtime);
  sessionModule.setActiveStorefrontMerchant(scope);
  const stored = await sessionModule.browserCartSessionStore.get(cart.locationId);
  if (
    !stored ||
    stored.cartId !== cart.id ||
    stored.revision !== cart.revision
  ) {
    throw new StorefrontCheckoutAdjustmentError({
      state: "cart-conflict",
      code: stored ? "CART_CONFLICT" : "CART_EXPIRED",
      message: stored
        ? "The cart changed. Refresh before changing checkout adjustments."
        : "The ordering session expired.",
    });
  }
  let authoritativeCart = cart;
  let persistFixtureCart: ((cart: StorefrontCart) => void) | undefined;
  if (runtime.mode === "fixture") {
    const snapshotModule = await import("@/fixtures/cart-snapshot");
    const snapshot = snapshotModule.readFixtureCartSnapshot(
      scope,
      cart.locationId,
    );
    if (
      !snapshot ||
      snapshot.id !== cart.id ||
      snapshot.revision !== cart.revision
    ) {
      if (snapshot) {
        await sessionModule.browserCartSessionStore.set({
          merchantSlug: scope,
          locationId: snapshot.locationId,
          cartId: snapshot.id,
          revision: snapshot.revision,
        });
      }
      throw new StorefrontCheckoutAdjustmentError({
        state: snapshot ? "cart-conflict" : "unavailable",
        code: snapshot ? "CART_CONFLICT" : "CART_EXPIRED",
        message: snapshot
          ? "The cart changed. Refresh before changing checkout adjustments."
          : "The ordering session expired.",
      }, snapshot);
    }
    authoritativeCart = snapshot;
    persistFixtureCart = (returnedCart) =>
      snapshotModule.writeFixtureCartSnapshot(scope, returnedCart);
  }
  return {
    scope,
    cart: authoritativeCart,
    persist: async (returnedCart: StorefrontCart) => {
      await sessionModule.browserCartSessionStore.set({
        merchantSlug: scope,
        locationId: returnedCart.locationId,
        cartId: returnedCart.id,
        revision: returnedCart.revision,
      });
      persistFixtureCart?.(returnedCart);
    },
  };
}

export async function mutateCheckoutAdjustment(input: Readonly<{
  runtime: CheckoutAdjustmentRuntime;
  cart: StorefrontCart;
  adjustment: Adjustment;
  idempotencyKey: string;
}>): Promise<StorefrontCheckoutAdjustmentResult> {
  const session = await requireCurrentSession(input.runtime, input.cart);
  const scope = adjustmentScope(input.runtime, session.cart);
  const signature = JSON.stringify(input.adjustment);
  const attempt = adjustmentAttempts.get(scope) ?? {
    cart: structuredClone(session.cart),
    idempotencyKey: input.idempotencyKey,
    signature,
  };
  if (attempt.signature !== signature) {
    throw new StorefrontCheckoutAdjustmentError({
      state: "operation-pending",
      code: "IDEMPOTENCY_IN_PROGRESS",
      message: "Finish checking the previous checkout adjustment before starting another.",
    });
  }
  if (attempt.cart.revision !== session.cart.revision) {
    adjustmentAttempts.delete(scope);
    throw new StorefrontCheckoutAdjustmentError({
      state: "cart-conflict",
      code: "CART_CONFLICT",
      message: "The cart changed. Review it before retrying the adjustment.",
    }, session.cart);
  }
  adjustmentAttempts.set(scope, attempt);
  let actions: StorefrontCheckoutAdjustmentActions;
  let cartActions: StorefrontCartActions;
  if (input.runtime.mode === "fixture") {
    const [adjustmentModule, fixtureModule] = await Promise.all([
      import("@/fixtures/checkout-adjustment-actions"),
      import("@/fixtures/storefront-actions"),
    ]);
    const { createFixtureCheckoutAdjustmentActions } = adjustmentModule;
    actions = createFixtureCheckoutAdjustmentActions(session.cart);
    cartActions = fixtureModule.createFixtureStorefrontActions(
      input.runtime.runtime,
      { initialCart: session.cart },
    ).cart;
  } else {
    const [{ storefrontClient }, actionModule, cartModule] = await Promise.all([
      import("@/lib/storefront/browser-client"),
      import("@/lib/storefront/checkout-adjustment-actions"),
      import("@/lib/storefront/cart-actions"),
    ]);
    actions = actionModule.createStorefrontCheckoutAdjustmentActions(
      storefrontClient,
    );
    cartActions = cartModule.createStorefrontCartActions(storefrontClient);
  }
  if (attempt.recoveryMode === "reconcile") {
    let refreshed: StorefrontCart;
    try {
      refreshed = await cartActions.get({
        locationId: attempt.cart.locationId,
        cartId: attempt.cart.id,
      });
    } catch (error) {
      const safe = checkoutErrorState(error);
      if (
        ![
          "network-error",
          "rate-limited",
          "dependency-unavailable",
          "operation-pending",
        ].includes(safe.state)
      ) {
        adjustmentAttempts.delete(scope);
      }
      throw error;
    }
    const issue = storefrontCartReadIssue(
      {
        locationId: attempt.cart.locationId,
        cartId: attempt.cart.id,
        revision: attempt.cart.revision,
      },
      refreshed,
    );
    if (issue) {
      adjustmentAttempts.delete(scope);
      throw new StorefrontCheckoutAdjustmentError({
        state: "integration-error",
        ...issue,
      });
    }
    await session.persist(refreshed);
    if (refreshed.revision > attempt.cart.revision) {
      adjustmentAttempts.delete(scope);
      if (cartMatchesAdjustment(refreshed, input.adjustment)) {
        return { state: "succeeded", cart: refreshed };
      }
      return {
        state: "retry-required",
        cart: refreshed,
        error: {
          state: "cart-conflict",
          code: "CART_CONFLICT",
          message: "The cart changed while the adjustment was processing.",
        },
      };
    }
    throw new StorefrontCheckoutAdjustmentError({
      state: "operation-pending",
      code: "IDEMPOTENCY_IN_PROGRESS",
      message: "The checkout adjustment is still processing.",
      retryAfterMs: 1_000,
    });
  }
  const identity = {
    locationId: session.cart.locationId,
    cartId: session.cart.id,
    revision: session.cart.revision,
    idempotencyKey: attempt.idempotencyKey,
  };
  try {
    const result =
      input.adjustment.kind === "gratuity"
        ? await actions.updateGratuity({
            ...identity,
            payload: input.adjustment.payload,
          })
        : input.adjustment.kind === "apply-discount"
          ? await actions.applyDiscount({
              ...identity,
              code: input.adjustment.code,
            })
          : await actions.removeDiscount(identity);
    await session.persist(result.cart);
    adjustmentAttempts.delete(scope);
    return result;
  } catch (error) {
    const safe = checkoutErrorState(error);
    if (safe.state === "operation-pending") {
      attempt.recoveryMode = "reconcile";
    } else if (
      safe.state !== "network-error"
    ) {
      adjustmentAttempts.delete(scope);
    }
    throw error;
  }
}

export function clearCheckoutAdjustmentRuntimeCacheForTests(): void {
  adjustmentAttempts.clear();
}

async function loyaltyActions(
  runtime: CheckoutAdjustmentRuntime,
  cart: StorefrontCart,
) {
  const session = await requireCurrentSession(runtime, cart);
  if (runtime.mode === "fixture") {
    const { createFixtureStorefrontLoyaltyActions } = await import(
      "@/fixtures/loyalty-actions"
    );
    return {
      actions: createFixtureStorefrontLoyaltyActions(
        runtime.runtime,
        runtime.runtime.config.capabilities.loyalty ? "enabled" : "disabled",
        session.cart,
      ),
      persist: session.persist,
      cart: session.cart,
    };
  }
  if (!runtime.loyaltyConfig) return null;
  const { createBrowserStorefrontLoyaltyActions } = await import(
    "@/features/loyalty/browser-loyalty-actions"
  );
  return {
    actions: createBrowserStorefrontLoyaltyActions(runtime.loyaltyConfig),
    persist: session.persist,
    cart: session.cart,
  };
}

export async function quoteCheckoutLoyalty(
  runtime: CheckoutAdjustmentRuntime,
  cart: StorefrontCart,
): Promise<StorefrontLoyaltyQuoteResult> {
  const loaded = await loyaltyActions(runtime, cart);
  if (!loaded) return {
    state: "disabled",
    reason: "profile-disabled",
    blocking: false,
  };
  return loaded.actions.cart.quote({
    locationId: loaded.cart.locationId,
    cartId: loaded.cart.id,
  });
}

export async function mutateCheckoutLoyalty(input: Readonly<{
  runtime: CheckoutAdjustmentRuntime;
  cart: StorefrontCart;
  action: Readonly<{ kind: "redeem"; rewardId: string }> | Readonly<{ kind: "cancel" }>;
  idempotencyKey: string;
}>): Promise<StorefrontLoyaltyMutationResult> {
  const loaded = await loyaltyActions(input.runtime, input.cart);
  if (!loaded) return {
    state: "disabled",
    reason: "profile-disabled",
    blocking: false,
  };
  const identity = {
    locationId: loaded.cart.locationId,
    cartId: loaded.cart.id,
    revision: loaded.cart.revision,
    idempotencyKey: input.idempotencyKey,
  };
  const result = input.action.kind === "redeem"
    ? await loaded.actions.cart.redeem({
        ...identity,
        rewardId: input.action.rewardId,
      })
    : await loaded.actions.cart.cancel(identity);
  if ("cart" in result && result.cart) await loaded.persist(result.cart);
  return result;
}
