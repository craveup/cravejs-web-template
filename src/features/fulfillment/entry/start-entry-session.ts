import type {
  StorefrontCartSession,
  StorefrontSessionStore,
} from "@craveup/storefront-sdk";

import type { StorefrontFulfillmentActions } from "@/lib/storefront/fulfillment-actions";
import {
  StorefrontOrderingSessionError,
  type StorefrontOrderingSessionActions,
  type StorefrontOrderingSessionResult,
} from "@/lib/storefront/ordering-session";

import { createEntrySessionBootstrapRequest } from "./entry-session";
import type { EntryIntent } from "./resolve-entry-intent";

export interface StartEntrySessionInput {
  readonly merchantSlug: string;
  readonly locationId: string;
  readonly intent: Exclude<EntryIntent, { kind: "invalid" }>;
  readonly idempotencyKey: string;
  readonly resetExistingCart?: boolean;
}

export interface EntrySessionDependencies {
  readonly orderingSession: StorefrontOrderingSessionActions;
  readonly fulfillment: StorefrontFulfillmentActions;
  readonly sessionStore: StorefrontSessionStore;
  readonly setMerchantScope: (merchantSlug: string) => void;
  readonly hasCustomerSession: (merchantSlug: string) => boolean;
  readonly persistReturnedSession: boolean;
  /** Freezes the logical request body across an explicit idempotent retry. */
  readonly initialSession?: StorefrontCartSession | null;
}

function detailIdempotencyKey(key: string) {
  return `entry_detail:${key}`;
}

export async function startEntrySession(
  input: StartEntrySessionInput,
  dependencies: EntrySessionDependencies,
): Promise<StorefrontOrderingSessionResult> {
  dependencies.setMerchantScope(input.merchantSlug);
  const hasFrozenInitialSession = Object.prototype.hasOwnProperty.call(
    dependencies,
    "initialSession",
  );
  if (input.resetExistingCart && !hasFrozenInitialSession) {
    await dependencies.sessionStore.clear(input.locationId);
  }
  const stored = hasFrozenInitialSession
    ? dependencies.initialSession ?? null
    : await dependencies.sessionStore.get(input.locationId);
  const request = createEntrySessionBootstrapRequest(
    input.locationId,
    input.intent,
    stored?.cartId,
  );
  if (!request) {
    throw new StorefrontOrderingSessionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The entry context is invalid.",
    });
  }

  const started = await dependencies.orderingSession.start({
    merchantSlug: input.merchantSlug,
    locationId: input.locationId,
    fulfillmentMethod: request.payload.fulfillmentMethod,
    channel: request.payload.channel ?? "unknown",
    idempotencyKey: input.idempotencyKey,
    ...(stored
      ? {
          existingCart: {
            cartId: stored.cartId,
            revision: stored.revision,
          },
        }
      : {}),
    ...(dependencies.hasCustomerSession(input.merchantSlug)
      ? { includeCustomerContext: true }
      : {}),
  });

  let cart = started.cart;
  let detailMutated = false;
  if (input.intent.kind === "table") {
    const tableResult = await dependencies.fulfillment.setTable({
      locationId: input.locationId,
      cartId: cart.id,
      revision: cart.revision,
      idempotencyKey: detailIdempotencyKey(input.idempotencyKey),
      tableNumber: input.intent.detail.tableIdentifier ?? "",
    });
    if (tableResult.state === "retry-required") {
      throw new StorefrontOrderingSessionError(tableResult.error);
    }
    cart = tableResult.cart;
    detailMutated = true;
  }

  if (dependencies.persistReturnedSession || detailMutated) {
    const current = await dependencies.sessionStore.get(input.locationId);
    await dependencies.sessionStore.set({
      ...(current?.cartId === cart.id ? current : {}),
      merchantSlug: input.merchantSlug,
      locationId: input.locationId,
      cartId: cart.id,
      revision: cart.revision,
    });
  }

  return { cart, resumed: started.resumed };
}
