import type {
  StorefrontCart,
  StorefrontCartSession,
} from "@craveup/storefront-sdk";

import { fixtureEmptyCart, fixturePickupCart } from "@/fixtures/cart";
import {
  readFixtureCartSnapshot,
  writeFixtureCartSnapshot,
} from "@/fixtures/cart-snapshot";
import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import { createFixtureStorefrontActions } from "@/fixtures/storefront-actions";
import { getCustomerToken } from "@/lib/storefront/customer-session";
import {
  StorefrontOrderingSessionError,
  type StorefrontOrderingSessionResult,
} from "@/lib/storefront/ordering-session";
import {
  createMerchantCartSessionStore,
  setActiveStorefrontMerchant,
} from "@/lib/storefront/session-store";

import type { EntryIntent } from "./resolve-entry-intent";
import { startEntrySession } from "./start-entry-session";

export type EntrySessionRuntime =
  | Readonly<{ kind: "fixture"; runtime: FixtureRuntime }>
  | Readonly<{
      kind: "live";
      merchantSlug: string;
    }>;

export interface RunEntrySessionInput {
  readonly locationId: string;
  readonly intent: Exclude<EntryIntent, { kind: "invalid" }>;
  readonly idempotencyKey: string;
  readonly resetExistingCart?: boolean;
}

interface EntryAttempt {
  readonly initialSession: StorefrontCartSession | null;
  readonly customerToken: string | null;
  recoveryMode?: "reconcile";
  retryAfterMs?: number;
}

const entryAttempts = new Map<string, EntryAttempt>();

function entryAttemptScope(
  merchantSlug: string,
  input: RunEntrySessionInput,
): string {
  return JSON.stringify([merchantSlug, input.locationId, input.idempotencyKey]);
}

function retainEntryAttempt(error: unknown): boolean {
  return (
    error instanceof StorefrontOrderingSessionError &&
    [
      "network-error",
      "rate-limited",
      "dependency-unavailable",
      "operation-pending",
    ].includes(error.state)
  );
}

function cartCompletesEntry(
  cart: StorefrontCart,
  intent: RunEntrySessionInput["intent"],
): boolean {
  if (intent.kind === "table") {
    return (
      cart.fulfilmentMethod === "table_side" &&
      cart.tableServiceInfo?.tableNumber === intent.detail.tableIdentifier
    );
  }
  if (intent.kind === "room") {
    return cart.fulfilmentMethod === "room_service";
  }
  return cart.fulfilmentMethod === "takeout";
}

function stillProcessing(attempt: EntryAttempt): StorefrontOrderingSessionError {
  return new StorefrontOrderingSessionError({
    state: "operation-pending",
    code: "IDEMPOTENCY_IN_PROGRESS",
    message: "The ordering session is still being started.",
    retryAfterMs: attempt.retryAfterMs ?? 1_000,
  });
}

export async function runEntrySession(
  runtime: EntrySessionRuntime,
  input: RunEntrySessionInput,
): Promise<StorefrontOrderingSessionResult> {
  const merchantSlug =
    runtime.kind === "fixture"
      ? runtime.runtime.config.merchantSlug
      : runtime.merchantSlug;
  const sessionStore = createMerchantCartSessionStore(merchantSlug);
  const attemptScope = entryAttemptScope(merchantSlug, input);
  let attempt = entryAttempts.get(attemptScope);
  if (!attempt) {
    if (input.resetExistingCart) {
      await sessionStore.clear(input.locationId);
    }
    attempt = {
      initialSession: input.resetExistingCart
        ? null
        : await sessionStore.get(input.locationId),
      customerToken: getCustomerToken(merchantSlug),
    };
    entryAttempts.set(attemptScope, attempt);
  }

  if (runtime.kind === "fixture") {
    let stored = attempt.initialSession;
    const snapshot = readFixtureCartSnapshot(
      merchantSlug,
      input.locationId,
    );
    if (attempt.recoveryMode === "reconcile") {
      const latestSession = await sessionStore.get(input.locationId);
      if (
        latestSession &&
        snapshot &&
        snapshot.id === latestSession.cartId &&
        snapshot.revision === latestSession.revision &&
        cartCompletesEntry(snapshot, input.intent)
      ) {
        entryAttempts.delete(attemptScope);
        return { cart: snapshot, resumed: attempt.initialSession !== null };
      }
      throw stillProcessing(attempt);
    }
    if (
      stored &&
      (!snapshot ||
        snapshot.id !== stored.cartId ||
        snapshot.revision !== stored.revision ||
        snapshot.status !== "OPEN")
    ) {
      await sessionStore.clear(input.locationId);
      stored = null;
    }
    const initialCart =
      stored && snapshot
        ? snapshot
        : input.resetExistingCart
          ? fixtureEmptyCart
          : fixturePickupCart;
    const actions = createFixtureStorefrontActions(runtime.runtime, {
      initialCart,
    });
    try {
      const result = await startEntrySession(
        { ...input, merchantSlug },
        {
          orderingSession: actions.orderingSession,
          fulfillment: actions.fulfillment,
          sessionStore,
          setMerchantScope: setActiveStorefrontMerchant,
          hasCustomerSession: () => attempt.customerToken !== null,
          persistReturnedSession: true,
          initialSession: stored,
        },
      );
      writeFixtureCartSnapshot(merchantSlug, result.cart);
      entryAttempts.delete(attemptScope);
      return result;
    } catch (error) {
      if (
        error instanceof StorefrontOrderingSessionError &&
        error.state === "operation-pending"
      ) {
        attempt.recoveryMode = "reconcile";
        attempt.retryAfterMs = error.retryAfterMs;
      }
      if (!retainEntryAttempt(error)) entryAttempts.delete(attemptScope);
      throw error;
    }
  }

  const [clientModule, orderingSessionModule, fulfillmentModule] =
    await Promise.all([
      import("@/lib/storefront/browser-client"),
      import("@/lib/storefront/ordering-session"),
      import("@/lib/storefront/fulfillment-actions"),
    ]);
  const client = clientModule.createBrowserStorefrontClient({
    getAuthToken: () => attempt.customerToken,
    sessionStore,
  });
  if (attempt.recoveryMode === "reconcile") {
    const latestSession = await sessionStore.get(input.locationId);
    if (latestSession) {
      const cart = await client.cart.get(input.locationId, latestSession.cartId);
      if (cartCompletesEntry(cart, input.intent)) {
        entryAttempts.delete(attemptScope);
        return { cart, resumed: attempt.initialSession !== null };
      }
    }
    throw stillProcessing(attempt);
  }
  try {
    const result = await startEntrySession(
      { ...input, merchantSlug },
      {
        orderingSession: orderingSessionModule.createStorefrontOrderingSession(
          client,
          sessionStore,
        ),
        fulfillment: fulfillmentModule.createStorefrontFulfillmentActions(
          client,
        ),
        sessionStore,
        setMerchantScope: setActiveStorefrontMerchant,
        hasCustomerSession: () => attempt.customerToken !== null,
        persistReturnedSession: false,
        initialSession: attempt.initialSession,
      },
    );
    entryAttempts.delete(attemptScope);
    return result;
  } catch (error) {
    if (
      error instanceof StorefrontOrderingSessionError &&
      error.state === "operation-pending"
    ) {
      attempt.recoveryMode = "reconcile";
      attempt.retryAfterMs = error.retryAfterMs;
    }
    if (!retainEntryAttempt(error)) entryAttempts.delete(attemptScope);
    throw error;
  }
}

export function clearEntrySessionRuntimeCacheForTests(): void {
  entryAttempts.clear();
}
