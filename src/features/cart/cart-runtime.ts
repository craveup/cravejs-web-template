import type { StorefrontCart } from "@craveup/storefront-sdk";

import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import type { StorefrontCartActions } from "@/lib/storefront/cart-actions";

import {
  createCartMutationCoordinator,
  type CartMutationCoordinator,
} from "./cart-mutation-coordinator";

export type CartActionRuntime =
  | Readonly<{ mode: "fixture"; runtime: FixtureRuntime }>
  | Readonly<{ mode: "live"; merchantSlug: string }>;

interface RuntimeCoordinatorEntry {
  readonly actions: Promise<StorefrontCartActions>;
  readonly coordinator: Promise<CartMutationCoordinator>;
}

const coordinators = new Map<string, RuntimeCoordinatorEntry>();

function scopeKey(runtime: CartActionRuntime, cart: StorefrontCart): string {
  const merchantSlug =
    runtime.mode === "fixture"
      ? runtime.runtime.config.merchantSlug
      : runtime.merchantSlug;
  return JSON.stringify([
    runtime.mode,
    merchantSlug,
    cart.merchantId,
    cart.locationId,
    cart.id,
  ]);
}

async function fixtureActions(
  runtime: Extract<CartActionRuntime, { mode: "fixture" }>,
  initialCart: StorefrontCart,
): Promise<StorefrontCartActions> {
  const [{ createFixtureStorefrontActions }, sessionModule, snapshotModule] = await Promise.all([
    import("@/fixtures/storefront-actions"),
    import("@/lib/storefront/session-store"),
    import("@/fixtures/cart-snapshot"),
  ]);
  const merchantSlug = runtime.runtime.config.merchantSlug;
  const sessionStore = sessionModule.createMerchantCartSessionStore(merchantSlug);
  await sessionStore.set({
    merchantSlug,
    locationId: initialCart.locationId,
    cartId: initialCart.id,
    revision: initialCart.revision,
  });
  snapshotModule.writeFixtureCartSnapshot(merchantSlug, initialCart);
  const actions = createFixtureStorefrontActions(runtime.runtime, {
    initialCart,
  }).cart;

  async function persist<T extends { readonly cart: StorefrontCart }>(
    result: T,
  ): Promise<T> {
    await sessionStore.set({
      merchantSlug,
      locationId: result.cart.locationId,
      cartId: result.cart.id,
      revision: result.cart.revision,
    });
    snapshotModule.writeFixtureCartSnapshot(merchantSlug, result.cart);
    return result;
  }

  return {
    get: actions.get,
    addItem: async (input) => persist(await actions.addItem(input)),
    updateItemQuantity: async (input) =>
      persist(await actions.updateItemQuantity(input)),
    removeItem: async (input) => persist(await actions.removeItem(input)),
    delete: async (input) => {
      const result = await actions.delete(input);
      if (result.state === "deleted") {
        await sessionStore.clear(input.locationId);
        snapshotModule.writeFixtureCartSnapshot(merchantSlug, result.cart);
      } else {
        await persist(result);
      }
      return result;
    },
  };
}

async function createRuntimeActions(
  runtime: CartActionRuntime,
  initialCart: StorefrontCart,
): Promise<StorefrontCartActions> {
  if (runtime.mode === "fixture") {
    return fixtureActions(runtime, initialCart);
  }

  const [clientModule, actionModule, sessionModule, customerSessionModule] = await Promise.all([
    import("@/lib/storefront/browser-client"),
    import("@/lib/storefront/cart-actions"),
    import("@/lib/storefront/session-store"),
    import("@/lib/storefront/customer-session"),
  ]);
  const sessionStore = sessionModule.createMerchantCartSessionStore(
    runtime.merchantSlug,
  );
  const client = clientModule.createBrowserStorefrontClient({
    getAuthToken: () => customerSessionModule.getCustomerToken(runtime.merchantSlug),
    sessionStore,
  });
  return actionModule.createStorefrontCartActions(
    client,
  );
}

export function loadCartMutationCoordinator(
  runtime: CartActionRuntime,
  initialCart: StorefrontCart,
): Promise<CartMutationCoordinator> {
  const scope = scopeKey(runtime, initialCart);
  const existing = coordinators.get(scope);
  if (existing) {
    return Promise.all([existing.actions, existing.coordinator]).then(
      ([actions, coordinator]) => {
        if (
          coordinator.getSnapshot().state === "terminal" &&
          initialCart.status === "OPEN"
        ) {
          coordinators.delete(scope);
          return loadCartMutationCoordinator(runtime, initialCart);
        }
        return createCartMutationCoordinator({ actions, initialCart });
      },
    );
  }

  const actions = createRuntimeActions(runtime, initialCart);
  const coordinator = actions
    .then((resolvedActions) =>
      createCartMutationCoordinator({
        actions: resolvedActions,
        initialCart,
      }),
    )
    .catch((error) => {
      coordinators.delete(scope);
      throw error;
    });
  coordinators.set(scope, { actions, coordinator });
  return coordinator;
}

export function clearCartRuntimeCacheForTests(): void {
  coordinators.clear();
}
