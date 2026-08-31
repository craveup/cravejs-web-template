import type {
  StorefrontCart,
  StorefrontCartSession,
} from "@craveup/storefront-sdk";

import type { CheckoutIdentityResult } from "./checkout-identity";
import { runPickupPreflight, type PickupPreflightResult } from "./pickup-preflight";
import {
  runTablesidePreflight,
  type TablesidePreflightResult,
} from "./tableside-preflight";
import { toStorefrontErrorState } from "@/lib/storefront/error-state";

interface PreflightAttempt {
  readonly idempotencyKey: string;
  readonly identityFingerprint: string;
  readonly session: StorefrontCartSession;
  readonly customerToken: string | null;
  recoveryMode?: "reconcile";
  pendingError?: unknown;
}

type CheckoutPreflightVariant =
  | Readonly<{ kind: "pickup" }>
  | Readonly<{ kind: "tableside"; expectedTableIdentifier: string }>;

interface LoadCheckoutPreflightInput {
  readonly merchantSlug: string;
  readonly locationId: string;
  readonly mode: "fixture" | "live";
  readonly identity: CheckoutIdentityResult;
  readonly variant: CheckoutPreflightVariant;
}

const preflightAttempts = new Map<string, PreflightAttempt>();

function variantFingerprint(variant: CheckoutPreflightVariant): string {
  return variant.kind === "pickup"
    ? "pickup"
    : JSON.stringify(["tableside", variant.expectedTableIdentifier.trim()]);
}

function preflightScope(
  merchantSlug: string,
  locationId: string,
  variant: CheckoutPreflightVariant,
): string {
  return JSON.stringify([
    merchantSlug,
    locationId,
    variantFingerprint(variant),
  ]);
}

function identityFingerprint(
  identity: CheckoutIdentityResult,
  variant: CheckoutPreflightVariant,
): string {
  return JSON.stringify({
    variant: variantFingerprint(variant),
    orderName: identity.orderName?.trim() ?? null,
    customerName: identity.profile.customerName ?? null,
    lastName: identity.profile.lastName ?? null,
    phoneNumber: identity.profile.phoneNumber ?? null,
    customerEmail: identity.profile.customerEmail ?? null,
  });
}

function preflightAttempt(
  scope: string,
  identity: CheckoutIdentityResult,
  variant: CheckoutPreflightVariant,
  session: StorefrontCartSession,
  customerToken: string | null,
): Readonly<{ attempt: PreflightAttempt; replay: boolean }> {
  const existing = preflightAttempts.get(scope);
  const fingerprint = identityFingerprint(identity, variant);
  if (existing && existing.identityFingerprint === fingerprint) {
    return { attempt: existing, replay: true };
  }
  const created = {
    idempotencyKey: globalThis.crypto.randomUUID(),
    identityFingerprint: fingerprint,
    session,
    customerToken,
  };
  preflightAttempts.set(scope, created);
  return { attempt: created, replay: false };
}

function runVariantPreflight(
  client: Parameters<typeof runPickupPreflight>[0],
  input: LoadCheckoutPreflightInput,
  attempt: PreflightAttempt,
  replay: boolean,
): Promise<PickupPreflightResult | TablesidePreflightResult> {
  const shared = {
    locationId: input.locationId,
    cartId: attempt.session.cartId,
    customer: input.identity.profile,
    orderName: input.identity.orderName,
    idempotencyKey: attempt.idempotencyKey,
    expectedRevision: attempt.session.revision,
    replay,
  };
  return input.variant.kind === "pickup"
    ? runPickupPreflight(client, shared)
    : runTablesidePreflight(client, {
        ...shared,
        expectedTableIdentifier: input.variant.expectedTableIdentifier,
      });
}

async function loadCheckoutPreflight(
  input: LoadCheckoutPreflightInput & Readonly<{ variant: { kind: "pickup" } }>,
): Promise<PickupPreflightResult>;
async function loadCheckoutPreflight(
  input: LoadCheckoutPreflightInput & Readonly<{
    variant: { kind: "tableside"; expectedTableIdentifier: string };
  }>,
): Promise<TablesidePreflightResult>;
async function loadCheckoutPreflight(
  input: LoadCheckoutPreflightInput,
): Promise<PickupPreflightResult | TablesidePreflightResult> {
  const [sessionModule, customerSessionModule] = await Promise.all([
    import("@/lib/storefront/session-store"),
    import("@/lib/storefront/customer-session"),
  ]);
  const sessionStore = sessionModule.createMerchantCartSessionStore(
    input.merchantSlug,
  );
  const stored = await sessionStore.get(input.locationId);
  if (!stored) return { state: "blocked", reason: "missing-cart" };
  const scope = preflightScope(
    input.merchantSlug,
    input.locationId,
    input.variant,
  );
  const { attempt, replay } = preflightAttempt(
    scope,
    input.identity,
    input.variant,
    stored,
    customerSessionModule.getCustomerToken(input.merchantSlug),
  );

  let client: Parameters<typeof runPickupPreflight>[0];
  let persistFixtureCart: ((cart: StorefrontCart) => void) | undefined;
  if (input.mode === "fixture") {
    const { readFixtureCartSnapshot, writeFixtureCartSnapshot } = await import(
      "@/fixtures/cart-snapshot"
    );
    const cart = readFixtureCartSnapshot(input.merchantSlug, input.locationId);
    if (
      !cart ||
      cart.id !== attempt.session.cartId ||
      (!replay && cart.revision !== attempt.session.revision)
    ) {
      preflightAttempts.delete(scope);
      return { state: "blocked", reason: "stale", ...(cart ? { cart } : {}) };
    }
    let authoritativeCart = cart;
    client = {
      cart: {
        get: async (locationId: string, cartId: string) => {
          if (
            locationId !== authoritativeCart.locationId ||
            cartId !== authoritativeCart.id
          ) {
            throw new TypeError("Fixture checkout cart scope does not match.");
          }
          return authoritativeCart;
        },
        validateAndUpdateCustomer: async (
          locationId: string,
          cartId: string,
        ) => {
          if (
            locationId !== authoritativeCart.locationId ||
            cartId !== authoritativeCart.id
          ) {
            throw new TypeError("Fixture checkout cart scope does not match.");
          }
          authoritativeCart = {
            ...authoritativeCart,
            revision: authoritativeCart.revision + 1,
          };
          return authoritativeCart;
        },
      },
    };
    persistFixtureCart = (nextCart) =>
      writeFixtureCartSnapshot(input.merchantSlug, nextCart);
  } else {
    const { createBrowserStorefrontClient } = await import(
      "@/lib/storefront/browser-client"
    );
    client = createBrowserStorefrontClient({
      getAuthToken: () => attempt.customerToken,
      sessionStore,
    });
  }

  async function persistReturnedCart(cart: StorefrontCart): Promise<boolean> {
    const current = await sessionStore.get(input.locationId);
    if (
      !current ||
      current.cartId !== cart.id ||
      current.revision > cart.revision
    ) {
      return false;
    }
    await sessionStore.set({
      ...current,
      merchantSlug: input.merchantSlug,
      locationId: input.locationId,
      cartId: cart.id,
      revision: cart.revision,
    });
    persistFixtureCart?.(cart);
    return true;
  }

  if (attempt.recoveryMode === "reconcile") {
    const refreshed = await client.cart.get(
      input.locationId,
      attempt.session.cartId,
    );
    if (refreshed.revision > attempt.session.revision) {
      await persistReturnedCart(refreshed);
      preflightAttempts.delete(scope);
      return { state: "blocked", reason: "stale", cart: refreshed };
    }
    throw attempt.pendingError ?? new Error("Checkout validation is still processing.");
  }

  let result: PickupPreflightResult | TablesidePreflightResult;
  try {
    result = await runVariantPreflight(client, input, attempt, replay);
  } catch (error) {
    const safe = toStorefrontErrorState(error);
    if (
      ![
        "network-error",
        "rate-limited",
        "dependency-unavailable",
        "operation-pending",
      ].includes(safe.state)
    ) {
      preflightAttempts.delete(scope);
    }
    if (safe.state === "operation-pending") {
      attempt.recoveryMode = "reconcile";
      attempt.pendingError = error;
    }
    throw error;
  }
  if (result.cart) {
    const persisted = await persistReturnedCart(result.cart);
    if (!persisted) {
      result = { state: "blocked", reason: "stale", cart: result.cart };
    }
  }
  preflightAttempts.delete(scope);
  return result;
}

export function loadPickupPreflight(
  input: Omit<LoadCheckoutPreflightInput, "variant">,
): Promise<PickupPreflightResult> {
  return loadCheckoutPreflight({ ...input, variant: { kind: "pickup" } });
}

export function loadTablesidePreflight(
  input: Omit<LoadCheckoutPreflightInput, "variant"> &
    Readonly<{ expectedTableIdentifier: string }>,
): Promise<TablesidePreflightResult> {
  return loadCheckoutPreflight({
    ...input,
    variant: {
      kind: "tableside",
      expectedTableIdentifier: input.expectedTableIdentifier,
    },
  });
}

export function clearCheckoutPreflightRuntimeCacheForTests(): void {
  preflightAttempts.clear();
}
