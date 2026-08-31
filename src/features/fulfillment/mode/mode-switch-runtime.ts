import type { StorefrontCart } from "@craveup/storefront-sdk";

import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import {
  StorefrontCartActionError,
  type StorefrontCartActions,
} from "@/lib/storefront/cart-actions";
import { toStorefrontErrorState } from "@/lib/storefront/error-state";
import { StorefrontOrderingSessionError } from "@/lib/storefront/ordering-session";

import type { FulfillmentDetail, FulfillmentMode } from "../types";
import type { ModeSwitchResult } from "./mode-picker";

export type ModeSwitchRuntime =
  | Readonly<{ mode: "fixture"; runtime: FixtureRuntime }>
  | Readonly<{ mode: "live"; merchantSlug: string }>;

interface ModeAttempt {
  readonly idempotencyKey: string;
  readonly existingCart?: Readonly<{ cartId: string; revision: number }>;
  readonly customerToken: string | null;
  recoveryMode?: "reconcile";
}

const modeAttempts = new Map<string, ModeAttempt>();

function attemptKey(
  merchantSlug: string,
  locationId: string,
  requestedMode: FulfillmentMode,
): string {
  return JSON.stringify([merchantSlug, locationId, requestedMode]);
}

function orderingErrorState(error: unknown) {
  return error instanceof StorefrontOrderingSessionError ||
    error instanceof StorefrontCartActionError
    ? {
        state: error.state,
        code: error.code,
        message: error.message,
        retryAfterMs: error.retryAfterMs,
      }
    : toStorefrontErrorState(error);
}

function detailFromCart(cart: StorefrontCart): FulfillmentDetail {
  if (cart.fulfilmentMethod === "delivery") {
    return { mode: "delivery" };
  }
  if (cart.fulfilmentMethod === "table_side") {
    return {
      mode: "table-side",
      ...(cart.tableServiceInfo?.tableNumber
        ? { tableIdentifier: cart.tableServiceInfo.tableNumber }
        : {}),
    };
  }
  if (cart.fulfilmentMethod === "room_service") {
    return {
      mode: "room-service",
      ...(cart.roomServiceInfo?.roomNumber
        ? { roomIdentifier: cart.roomServiceInfo.roomNumber }
        : {}),
      ...(cart.roomServiceInfo?.lastName
        ? { lastName: cart.roomServiceInfo.lastName }
        : {}),
    };
  }
  return { mode: "takeout" };
}

function wireMode(mode: FulfillmentMode) {
  return mode === "table-side"
    ? "table_side"
    : mode === "room-service"
      ? "room_service"
      : mode;
}

export async function switchFulfillmentMode(
  runtime: ModeSwitchRuntime,
  locationId: string,
  requestedMode: FulfillmentMode,
): Promise<ModeSwitchResult> {
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
  const scope = attemptKey(merchantSlug, locationId, requestedMode);
  const attempt = modeAttempts.get(scope) ?? {
    idempotencyKey: globalThis.crypto.randomUUID(),
    customerToken: customerSessionModule.getCustomerToken(merchantSlug),
    ...(stored
      ? { existingCart: { cartId: stored.cartId, revision: stored.revision } }
      : {}),
  };
  modeAttempts.set(scope, attempt);

  let orderingSession;
  let cartActions: StorefrontCartActions;
  let persistFixtureCart:
    | ((cart: StorefrontCart) => Promise<void>)
    | undefined;
  if (runtime.mode === "fixture") {
    const [{ createFixtureStorefrontActions }, cartModule, snapshotModule] =
      await Promise.all([
        import("@/fixtures/storefront-actions"),
        import("@/fixtures/cart"),
        import("@/fixtures/cart-snapshot"),
      ]);
    const snapshot = snapshotModule.readFixtureCartSnapshot(
      merchantSlug,
      locationId,
    );
    if (
      stored &&
      (!snapshot ||
        snapshot.id !== stored.cartId ||
        snapshot.revision !== stored.revision)
    ) {
      modeAttempts.delete(scope);
      if (snapshot) {
        await sessionStore.set({
          merchantSlug,
          locationId,
          cartId: snapshot.id,
          revision: snapshot.revision,
        });
        return { status: "conflict", detail: detailFromCart(snapshot) };
      }
      return { status: "expired" };
    }
    const actions = createFixtureStorefrontActions(runtime.runtime, {
      initialCart: stored && snapshot ? snapshot : cartModule.fixtureEmptyCart,
    });
    orderingSession = actions.orderingSession;
    cartActions = actions.cart;
    persistFixtureCart = async (cart) => {
      await sessionStore.set({
        merchantSlug,
        locationId,
        cartId: cart.id,
        revision: cart.revision,
      });
      snapshotModule.writeFixtureCartSnapshot(merchantSlug, cart);
    };
  } else {
    const [clientModule, orderingModule, cartModule] =
      await Promise.all([
        import("@/lib/storefront/browser-client"),
        import("@/lib/storefront/ordering-session"),
        import("@/lib/storefront/cart-actions"),
      ]);
    const client = clientModule.createBrowserStorefrontClient({
      getAuthToken: () => attempt.customerToken,
      sessionStore,
    });
    orderingSession = orderingModule.createStorefrontOrderingSession(
      client,
      sessionStore,
    );
    cartActions = cartModule.createStorefrontCartActions(client);
  }

  try {
    if (attempt.recoveryMode === "reconcile") {
      if (!attempt.existingCart) {
        modeAttempts.delete(scope);
        return { status: "expired" };
      }
      const refreshed = await cartActions.get({
        locationId,
        cartId: attempt.existingCart.cartId,
      });
      await sessionStore.set({
        merchantSlug,
        locationId,
        cartId: refreshed.id,
        revision: refreshed.revision,
      });
      await persistFixtureCart?.(refreshed);
      if (refreshed.fulfilmentMethod === wireMode(requestedMode)) {
        modeAttempts.delete(scope);
        return { status: "success", detail: detailFromCart(refreshed) };
      }
      if (refreshed.revision > attempt.existingCart.revision) {
        modeAttempts.delete(scope);
        return { status: "conflict", detail: detailFromCart(refreshed) };
      }
      return { status: "processing", retryAfterSeconds: 1 };
    }
    const result = await orderingSession.start({
      merchantSlug,
      locationId,
      fulfillmentMethod: wireMode(requestedMode),
      channel: "web",
      idempotencyKey: attempt.idempotencyKey,
      ...(attempt.existingCart ? { existingCart: attempt.existingCart } : {}),
      ...(attempt.customerToken
        ? { includeCustomerContext: true }
        : {}),
    });
    await persistFixtureCart?.(result.cart);
    modeAttempts.delete(scope);
    return { status: "success", detail: detailFromCart(result.cart) };
  } catch (error) {
    const safeError = orderingErrorState(error);
    const code = safeError.code;
    if (code === "CART_IMMUTABLE") {
      modeAttempts.delete(scope);
      return { status: "immutable" };
    }
    if (code === "CART_EXPIRED") {
      modeAttempts.delete(scope);
      return { status: "expired" };
    }
    if (code === "CART_CONFLICT" && attempt.existingCart) {
      const refreshed = await cartActions.get({
        locationId,
        cartId: attempt.existingCart.cartId,
      });
      await sessionStore.set({
        merchantSlug,
        locationId,
        cartId: refreshed.id,
        revision: refreshed.revision,
      });
      if (persistFixtureCart) {
        await persistFixtureCart(refreshed);
      }
      modeAttempts.delete(scope);
      return { status: "conflict", detail: detailFromCart(refreshed) };
    }
    if (safeError.state === "rate-limited") {
      return {
        status: "rate-limited",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((safeError.retryAfterMs ?? 1_000) / 1_000),
        ),
      };
    }
    if (safeError.state === "operation-pending") {
      attempt.recoveryMode = "reconcile";
      return {
        status: "processing",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((safeError.retryAfterMs ?? 1_000) / 1_000),
        ),
      };
    }
    if (safeError.state === "dependency-unavailable") {
      return { status: "unavailable", retryAfterSeconds: 1 };
    }
    if (
      ![
        "network-error",
        "rate-limited",
        "dependency-unavailable",
        "operation-pending",
      ].includes(safeError.state)
    ) {
      modeAttempts.delete(scope);
    }
    throw error;
  }
}

export function clearModeSwitchRuntimeCacheForTests(): void {
  modeAttempts.clear();
}
