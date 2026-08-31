import type {
  StorefrontCart,
  StorefrontCartSession,
  StorefrontSessionStore,
} from "@craveup/storefront-sdk";

import { loadCartMutationCoordinator } from "@/features/cart/cart-runtime";
import type { CartMutationCoordinator } from "@/features/cart/cart-mutation-coordinator";
import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import { startEntrySession } from "@/features/fulfillment/entry/start-entry-session";
import { StorefrontOrderingSessionError } from "@/lib/storefront/ordering-session";

import {
  createProductCartAction,
  type ProductCartAction,
} from "./add-to-cart";

export type ProductCartRuntime =
  | Readonly<{ mode: "fixture"; runtime: FixtureRuntime }>
  | Readonly<{ mode: "live"; merchantSlug: string }>;

interface ProductCartRuntimeResult {
  readonly action: ProductCartAction;
  readonly coordinator: CartMutationCoordinator;
}

interface ProductCartRuntimeEntry {
  readonly idempotencyKey: string;
  readonly attemptContext: Promise<ProductCartAttemptContext>;
  promise?: Promise<ProductCartRuntimeResult>;
  result?: ProductCartRuntimeResult;
}

const actionsByScope = new Map<string, ProductCartRuntimeEntry>();

export interface ProductCartRuntimeDependencies {
  readonly createIdempotencyKey: () => string;
  readonly startSession: typeof startEntrySession;
}

interface ProductCartAttemptContext {
  readonly customerToken: string | null;
  readonly includeCustomerContext: boolean;
  readonly initialSession: StorefrontCartSession | null;
  readonly sessionStore: StorefrontSessionStore;
}

const defaultDependencies: ProductCartRuntimeDependencies = {
  createIdempotencyKey: () => globalThis.crypto.randomUUID(),
  startSession: startEntrySession,
};

function runtimeScope(runtime: ProductCartRuntime, locationId: string): string {
  const merchantSlug =
    runtime.mode === "fixture"
      ? runtime.runtime.config.merchantSlug
      : runtime.merchantSlug;
  const profile =
    runtime.mode === "fixture" ? runtime.runtime.config.profile : "live";
  return JSON.stringify([runtime.mode, profile, merchantSlug, locationId]);
}

function isRetryableSessionStartError(error: unknown): boolean {
  if (!(error instanceof StorefrontOrderingSessionError)) return false;
  return [
    "network-error",
    "rate-limited",
    "dependency-unavailable",
    "operation-pending",
  ].includes(error.state);
}

async function createAttemptSessionStore(
  runtime: ProductCartRuntime,
  locationId: string,
): Promise<ProductCartAttemptContext> {
  const [sessionModule, customerSessionModule] = await Promise.all([
    import("@/lib/storefront/session-store"),
    import("@/lib/storefront/customer-session"),
  ]);
  const merchantSlug =
    runtime.mode === "fixture"
      ? runtime.runtime.config.merchantSlug
      : runtime.merchantSlug;
  const merchantSessionStore = sessionModule.createMerchantCartSessionStore(
    merchantSlug,
  );
  const initialSession = await merchantSessionStore.get(locationId);
  const customerToken = customerSessionModule.getCustomerToken(merchantSlug);
  let attemptSession = initialSession;

  // A lost response may already have advanced the real browser session. Keep
  // this logical retry byte-for-byte equivalent to its first SDK request.
  return {
    customerToken,
    includeCustomerContext: customerToken !== null,
    initialSession,
    sessionStore: {
      get: async (requestedLocationId) =>
        requestedLocationId === locationId ? attemptSession : null,
      set: (session) => {
        merchantSessionStore.set({
          ...session,
          merchantSlug,
        });
        attemptSession = { ...session, merchantSlug };
      },
      clear: (requestedLocationId) => {
        merchantSessionStore.clear(requestedLocationId);
        if (requestedLocationId === locationId) attemptSession = null;
      },
    },
  };
}

async function createRuntimeAction(
  runtime: ProductCartRuntime,
  locationId: string,
  idempotencyKey: string,
  attemptContext: ProductCartAttemptContext,
  startSession: typeof startEntrySession,
): Promise<ProductCartRuntimeResult> {
  const sessionModule = await import("@/lib/storefront/session-store");
  const merchantSlug =
    runtime.mode === "fixture"
      ? runtime.runtime.config.merchantSlug
      : runtime.merchantSlug;
  sessionModule.setActiveStorefrontMerchant(merchantSlug);

  let cart: StorefrontCart;
  if (runtime.mode === "fixture") {
    const [{ createFixtureStorefrontActions }, snapshotModule, cartModule] =
      await Promise.all([
        import("@/fixtures/storefront-actions"),
        import("@/fixtures/cart-snapshot"),
        import("@/fixtures/cart"),
      ]);
    const storedCart = snapshotModule.readFixtureCartSnapshot(
      merchantSlug,
      locationId,
    );
    const actions = createFixtureStorefrontActions(runtime.runtime, {
      initialCart:
        storedCart?.status === "OPEN" ? storedCart : cartModule.fixtureEmptyCart,
    });
    const result = await startSession(
      {
        merchantSlug,
        locationId,
        intent: { kind: "direct", detail: { mode: "takeout" } },
        idempotencyKey,
      },
      {
        orderingSession: actions.orderingSession,
        fulfillment: actions.fulfillment,
        sessionStore: attemptContext.sessionStore,
        setMerchantScope: sessionModule.setActiveStorefrontMerchant,
        hasCustomerSession: () => attemptContext.includeCustomerContext,
        persistReturnedSession: true,
        initialSession: attemptContext.initialSession,
      },
    );
    cart = result.cart;
    const coordinator = await loadCartMutationCoordinator(runtime, cart);
    return {
      action: createProductCartAction({ coordinator }),
      coordinator,
    };
  }

  const [clientModule, orderingSessionModule, fulfillmentModule] =
    await Promise.all([
      import("@/lib/storefront/browser-client"),
      import("@/lib/storefront/ordering-session"),
      import("@/lib/storefront/fulfillment-actions"),
    ]);
  const sessionClient = clientModule.createBrowserStorefrontClient({
    getAuthToken: () => attemptContext.customerToken,
    sessionStore: attemptContext.sessionStore,
  });
  const result = await startSession(
    {
      merchantSlug,
      locationId,
      intent: { kind: "direct", detail: { mode: "takeout" } },
      idempotencyKey,
    },
    {
      orderingSession: orderingSessionModule.createStorefrontOrderingSession(
        sessionClient,
        attemptContext.sessionStore,
      ),
      fulfillment:
        fulfillmentModule.createStorefrontFulfillmentActions(sessionClient),
      sessionStore: attemptContext.sessionStore,
      setMerchantScope: sessionModule.setActiveStorefrontMerchant,
      hasCustomerSession: () => attemptContext.includeCustomerContext,
      persistReturnedSession: false,
      initialSession: attemptContext.initialSession,
    },
  );
  cart = result.cart;
  const coordinator = await loadCartMutationCoordinator(runtime, cart);
  return {
    action: createProductCartAction({ coordinator }),
    coordinator,
  };
}

export async function loadProductCartAction(
  runtime: ProductCartRuntime,
  locationId: string,
  dependencies: ProductCartRuntimeDependencies = defaultDependencies,
): Promise<ProductCartAction> {
  const scope = runtimeScope(runtime, locationId);
  let existing = actionsByScope.get(scope);
  if (existing?.result?.coordinator.getSnapshot().state === "terminal") {
    actionsByScope.delete(scope);
    existing = undefined;
  }
  if (existing?.result) return existing.result.action;
  if (existing?.promise) {
    return existing.promise.then((result) => result.action);
  }

  const entry: ProductCartRuntimeEntry =
    existing ?? {
      idempotencyKey: dependencies.createIdempotencyKey(),
      attemptContext: createAttemptSessionStore(runtime, locationId),
    };
  const promise = entry.attemptContext
    .then((attemptContext) =>
      createRuntimeAction(
        runtime,
        locationId,
        entry.idempotencyKey,
        attemptContext,
        dependencies.startSession,
      ),
    )
    .then((result) => {
      entry.result = result;
      entry.promise = undefined;
      return result;
    })
    .catch((error) => {
      entry.promise = undefined;
      if (!isRetryableSessionStartError(error)) {
        actionsByScope.delete(scope);
      }
      throw error;
    });
  entry.promise = promise;
  actionsByScope.set(scope, entry);
  return promise.then((result) => result.action);
}

export function clearProductCartRuntimeCacheForTests(): void {
  actionsByScope.clear();
}
