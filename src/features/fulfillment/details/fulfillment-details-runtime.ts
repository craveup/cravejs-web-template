import type { StorefrontCart } from "@craveup/storefront-sdk";

import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import type { StorefrontCartActions } from "@/lib/storefront/cart-actions";
import { storefrontCartReadIssue } from "@/lib/storefront/cart-response";
import { toStorefrontErrorState } from "@/lib/storefront/error-state";
import type {
  StorefrontFulfillmentActions,
  StorefrontFulfillmentMutationResult,
  StorefrontRoomDetail,
} from "@/lib/storefront/fulfillment-actions";
import { StorefrontFulfillmentActionError } from "@/lib/storefront/fulfillment-actions";

export type FulfillmentDetailsRuntime =
  | Readonly<{ mode: "fixture"; runtime: FixtureRuntime }>
  | Readonly<{ mode: "live"; merchantSlug: string }>;

interface DetailAttempt {
  readonly cartId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
  readonly signature: string;
  recoveryMode?: "reconcile";
}

const detailAttempts = new Map<string, DetailAttempt>();

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

async function activeActions(
  runtime: FulfillmentDetailsRuntime,
  locationId: string,
): Promise<Readonly<{
  actions: StorefrontFulfillmentActions;
  cartActions: StorefrontCartActions;
  cart: Readonly<{ cartId: string; revision: number }>;
  merchantSlug: string;
  persist: (cart: StorefrontCart) => Promise<void>;
}>> {
  const sessionModule = await import("@/lib/storefront/session-store");
  const merchantSlug =
    runtime.mode === "fixture"
      ? runtime.runtime.config.merchantSlug
      : runtime.merchantSlug;
  sessionModule.setActiveStorefrontMerchant(merchantSlug);
  const cart = await sessionModule.browserCartSessionStore.get(locationId);
  if (!cart) {
    const { StorefrontFulfillmentActionError } = await import(
      "@/lib/storefront/fulfillment-actions"
    );
    throw new StorefrontFulfillmentActionError({
      state: "unavailable",
      code: "CART_EXPIRED",
      message: "The ordering session is no longer available.",
    });
  }

  let actions: StorefrontFulfillmentActions;
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
      snapshot.id !== cart.cartId ||
      snapshot.revision !== cart.revision
    ) {
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
          ? "The cart changed. Review it before setting fulfillment details."
          : "The ordering session is no longer available.",
      });
    }
    const fixtureActions = createFixtureStorefrontActions(runtime.runtime, {
      initialCart: snapshot,
    });
    actions = fixtureActions.fulfillment;
    cartActions = fixtureActions.cart;
    persistFixtureCart = (returnedCart) =>
      snapshotModule.writeFixtureCartSnapshot(merchantSlug, returnedCart);
  } else {
    const [{ storefrontClient }, actionModule, cartModule] = await Promise.all([
      import("@/lib/storefront/browser-client"),
      import("@/lib/storefront/fulfillment-actions"),
      import("@/lib/storefront/cart-actions"),
    ]);
    actions = actionModule.createStorefrontFulfillmentActions(storefrontClient);
    cartActions = cartModule.createStorefrontCartActions(storefrontClient);
  }

  return {
    actions,
    cartActions,
    cart,
    merchantSlug,
    persist: async (returnedCart) => {
      await sessionModule.browserCartSessionStore.set({
        merchantSlug,
        locationId,
        cartId: returnedCart.id,
        revision: returnedCart.revision,
      });
      persistFixtureCart?.(returnedCart);
    },
  };
}

async function runMutation(
  runtime: FulfillmentDetailsRuntime,
  locationId: string,
  kind: "table" | "room",
  detail: string | StorefrontRoomDetail,
  idempotencyKey: string,
  mutate: (
    actions: StorefrontFulfillmentActions,
    identity: Readonly<{
      locationId: string;
      cartId: string;
      revision: number;
      idempotencyKey: string;
    }>,
  ) => Promise<StorefrontFulfillmentMutationResult>,
) {
  const active = await activeActions(runtime, locationId);
  const scope = JSON.stringify([
    active.merchantSlug,
    locationId,
    active.cart.cartId,
  ]);
  const signature = JSON.stringify([kind, detail]);
  const attempt = detailAttempts.get(scope) ?? {
    cartId: active.cart.cartId,
    revision: active.cart.revision,
    idempotencyKey,
    signature,
  };
  if (attempt.signature !== signature) {
    throw new StorefrontFulfillmentActionError({
      state: "operation-pending",
      code: "IDEMPOTENCY_IN_PROGRESS",
      message: "Finish checking the previous fulfillment update before starting another.",
    });
  }
  if (
    attempt.cartId !== active.cart.cartId ||
    attempt.revision !== active.cart.revision
  ) {
    detailAttempts.delete(scope);
    throw new StorefrontFulfillmentActionError({
      state: "cart-conflict",
      code: "CART_CONFLICT",
      message: "The cart changed. Review it before retrying fulfillment details.",
    });
  }
  detailAttempts.set(scope, attempt);

  if (attempt.recoveryMode === "reconcile") {
    let refreshed: StorefrontCart;
    try {
      refreshed = await active.cartActions.get({
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
        detailAttempts.delete(scope);
      }
      throw error;
    }
    const issue = storefrontCartReadIssue(
      { locationId, cartId: attempt.cartId, revision: attempt.revision },
      refreshed,
    );
    if (issue) {
      detailAttempts.delete(scope);
      throw new StorefrontFulfillmentActionError({
        state: "integration-error",
        ...issue,
      });
    }
    await active.persist(refreshed);
    const confirmed =
      kind === "table"
        ? refreshed.fulfilmentMethod === "table_side" &&
          refreshed.tableServiceInfo?.tableNumber === detail
        : refreshed.fulfilmentMethod === "room_service" &&
          typeof detail !== "string" &&
          refreshed.roomServiceInfo?.roomNumber === detail.roomNumber &&
          refreshed.roomServiceInfo?.lastName === detail.lastName;
    if (confirmed) {
      detailAttempts.delete(scope);
      return { state: "succeeded" as const, cart: refreshed };
    }
    if (refreshed.revision === attempt.revision) {
      throw new StorefrontFulfillmentActionError({
        state: "operation-pending",
        code: "IDEMPOTENCY_IN_PROGRESS",
        message: "The fulfillment update is still processing.",
        retryAfterMs: 1_000,
      });
    }
    detailAttempts.delete(scope);
    return {
      state: "retry-required" as const,
      cart: refreshed,
      error: {
        state: "cart-conflict" as const,
        code: "CART_CONFLICT",
        message: "The cart changed while fulfillment details were processing.",
      },
    };
  }

  try {
    const result = await mutate(active.actions, {
      locationId,
      cartId: active.cart.cartId,
      revision: active.cart.revision,
      idempotencyKey: attempt.idempotencyKey,
    });
    await active.persist(result.cart);
    detailAttempts.delete(scope);
    return result;
  } catch (error) {
    const safe = fulfillmentErrorState(error);
    if (safe.state === "operation-pending") {
      attempt.recoveryMode = "reconcile";
    } else if (
      safe.state !== "network-error"
    ) {
      detailAttempts.delete(scope);
    }
    throw error;
  }
}

export function setTableFulfillmentDetails(
  runtime: FulfillmentDetailsRuntime,
  locationId: string,
  tableNumber: string,
  idempotencyKey: string,
) {
  return runMutation(runtime, locationId, "table", tableNumber, idempotencyKey, (actions, identity) =>
    actions.setTable({ ...identity, tableNumber }),
  );
}

export function setRoomFulfillmentDetails(
  runtime: FulfillmentDetailsRuntime,
  locationId: string,
  detail: StorefrontRoomDetail,
  idempotencyKey: string,
) {
  return runMutation(runtime, locationId, "room", detail, idempotencyKey, (actions, identity) =>
    actions.setRoom({ ...identity, detail }),
  );
}

export function clearFulfillmentDetailsRuntimeCacheForTests(): void {
  detailAttempts.clear();
}
