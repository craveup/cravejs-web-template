import {
  createStorefrontCheckoutActions,
  StorefrontCheckoutActionError,
  type StorefrontCheckoutActions,
} from "@/lib/storefront/checkout-actions";
import { createMerchantCartSessionStore } from "@/lib/storefront/session-store";
import type { StorefrontSessionStore } from "@craveup/storefront-sdk";

import type { FixtureRuntime } from "./fixture-runtime";
import { readFixtureCartSnapshot } from "./cart-snapshot";
import { fixtureTimeline } from "./reference-now";
import { fixtureScenarios } from "./scenarios";

export type FixtureCheckoutPrepareScenario =
  | "succeeded"
  | "dependency-unavailable"
  | "expired"
  | "lost-response"
  | "missing-capability"
  | "wrong-origin";

export interface FixtureStorefrontCheckoutOptions {
  readonly scenario?: FixtureCheckoutPrepareScenario;
}

export function createFixtureStorefrontCheckoutActions(
  runtime: FixtureRuntime,
  options: FixtureStorefrontCheckoutOptions = {},
): StorefrontCheckoutActions {
  const attempts = new Map<
    string,
    {
      readonly fingerprint: string;
      readonly handoffOrdinal: number;
    }
  >();
  let handoffCount = 0;
  const scenario = options.scenario ?? "succeeded";
  const authoritativeSessionStore = createMerchantCartSessionStore(
    runtime.config.merchantSlug,
  );
  const sessionStore = {
    async get(locationId: string) {
      const session = await authoritativeSessionStore.get(locationId);
      if (!session) return null;
      return {
        merchantSlug: session.merchantSlug,
        locationId: session.locationId,
        cartId: session.cartId,
        ...(scenario === "missing-capability"
          ? {}
          : { accessToken: "fixture-cart-capability" }),
        revision: session.revision,
      };
    },
    set: (session) => authoritativeSessionStore.set(session),
    clear: (locationId) => authoritativeSessionStore.clear(locationId),
  } satisfies StorefrontSessionStore;

  function fixturePrepareResult(handoffOrdinal: number) {
    const checkoutOrigin =
      scenario === "wrong-origin"
        ? fixtureScenarios.checkout.wrongOrigin.candidateOrigin
        : runtime.config.checkoutOrigins[0];
    const handoffPath =
      handoffOrdinal === 1
        ? "/fixture-handoff"
        : `/fixture-handoff-${handoffOrdinal}`;

    return {
      checkoutUrl: new URL(handoffPath, checkoutOrigin).toString(),
      expiresAt:
        scenario === "expired"
          ? fixtureTimeline.checkoutExpiredAt
          : fixtureTimeline.checkoutExpiresAt,
    };
  }

  const checkoutActions = createStorefrontCheckoutActions(
    {
      checkout: {
        async prepare(locationId, cartId, config) {
          const snapshot = readFixtureCartSnapshot(
            runtime.config.merchantSlug,
            locationId,
          );
          if (!snapshot || snapshot.id !== cartId) {
            throw new StorefrontCheckoutActionError({
              state: "access-denied",
              code: "CART_SESSION_MISMATCH",
              message: "The fixture checkout session is no longer available.",
            });
          }
          if (config?.revision !== snapshot.revision) {
            throw new StorefrontCheckoutActionError({
              state: "cart-conflict",
              code: "CART_CONFLICT",
              message: "The fixture cart changed. Refresh and retry.",
            });
          }

          if (scenario === "dependency-unavailable") {
            throw new StorefrontCheckoutActionError({
              state: "dependency-unavailable",
              code: fixtureScenarios.checkout.prepareFailure.code,
              message: "Fixture checkout is temporarily unavailable.",
            });
          }

          const idempotencyKey = config?.idempotencyKey;
          if (!idempotencyKey) {
            throw new StorefrontCheckoutActionError({
              state: "integration-error",
              code: "INVALID_IDEMPOTENCY_KEY",
              message: "The fixture checkout retry key is missing.",
            });
          }
          const fingerprint = JSON.stringify({
            merchantSlug: runtime.config.merchantSlug,
            locationId,
            cartId,
            revision: config.revision,
          });
          const previousAttempt = attempts.get(idempotencyKey);
          if (
            previousAttempt &&
            previousAttempt.fingerprint !== fingerprint
          ) {
            throw new StorefrontCheckoutActionError({
              state: "integration-error",
              code: "IDEMPOTENCY_KEY_REUSED",
              message: "The fixture retry key belongs to another request.",
            });
          }
          if (previousAttempt) {
            return fixturePrepareResult(previousAttempt.handoffOrdinal);
          }

          handoffCount += 1;
          attempts.set(idempotencyKey, {
            fingerprint,
            handoffOrdinal: handoffCount,
          });
          if (scenario === "lost-response") {
            throw new StorefrontCheckoutActionError({
              state: "network-error",
              code: "REQUEST_TIMEOUT",
              message:
                "The fixture checkout response was lost after preparation.",
            });
          }
          return fixturePrepareResult(handoffCount);
        },
      },
    },
    runtime.config.merchantSlug,
    sessionStore,
  );

  return checkoutActions;
}
