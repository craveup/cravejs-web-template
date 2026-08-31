import type {
  LoyaltyClaim,
  LoyaltyClaimSubmission,
  LoyaltyLedger,
  LoyaltyQuote,
  RequestConfig,
  StorefrontCart,
} from "@craveup/storefront-sdk";

import {
  createStorefrontLoyaltyActions,
  StorefrontLoyaltyActionError,
  type StorefrontLoyaltyActions,
  type StorefrontLoyaltyClient,
} from "@/features/loyalty/loyalty-actions";

import { fixtureCart, fixtureDiscountedCart } from "./cart";
import type { FixtureRuntime } from "./fixture-runtime";
import { fixtureLocation } from "./location";
import { fixtureTimeline } from "./reference-now";
import { fixtureScenarios } from "./scenarios";

export type FixtureLoyaltyAvailability =
  | "disabled"
  | "unavailable"
  | "enabled";

const fixtureClaims: readonly LoyaltyClaim[] = [
  {
    claimId: "fixture-loyalty-claim",
    status: "pending",
    submittedAt: fixtureTimeline.loyaltyEntryOccurredAt,
    reason: "missing_points",
    note: "Points did not appear.",
    updatedAt: fixtureTimeline.loyaltyEntryOccurredAt,
  },
];

function unavailableError(): StorefrontLoyaltyActionError {
  return new StorefrontLoyaltyActionError({
    state: "dependency-unavailable",
    code: "DEPENDENCY_UNAVAILABLE",
    message: "Rewards are temporarily unavailable.",
    requestId: "fixture-request-loyalty-unavailable",
  });
}

function assertRevision(
  currentCart: StorefrontCart,
  config: RequestConfig | undefined,
): void {
  if (config?.revision !== currentCart.revision) {
    throw new StorefrontLoyaltyActionError({
      state: "cart-conflict",
      code: "CART_CONFLICT",
      message: "The fixture cart changed. Refresh and try again.",
    });
  }
}

export function createFixtureStorefrontLoyaltyActions(
  runtime: FixtureRuntime,
  availability: FixtureLoyaltyAvailability = "disabled",
  initialCart: StorefrontCart = fixtureCart,
): StorefrontLoyaltyActions {
  let currentCart: StorefrontCart = { ...initialCart };
  let appliedRewardId: string | undefined;

  function assertCartScope(locationId: string, cartId: string): void {
    if (locationId !== fixtureLocation.id || cartId !== currentCart.id) {
      throw new StorefrontLoyaltyActionError({
        state: "access-denied",
        code: "FIXTURE_SCOPE_MISMATCH",
        message: "The fixture loyalty request is outside the active tenant.",
      });
    }
  }

  const client = {
    cart: {
      async get(locationId, cartId) {
        assertCartScope(locationId, cartId);
        return currentCart;
      },
    },
    loyalty: {
      async quote(locationId, cartId): Promise<LoyaltyQuote> {
        assertCartScope(locationId, cartId);
        const quote = fixtureScenarios.loyalty.quotes[availability];
        return availability === "enabled" && appliedRewardId
          ? { ...quote, appliedRewardId }
          : quote;
      },
      async redeem(locationId, cartId, rewardId, config) {
        assertCartScope(locationId, cartId);
        assertRevision(currentCart, config);
        appliedRewardId = rewardId;
        currentCart = {
          ...fixtureDiscountedCart,
          id: fixtureCart.id,
          revision: currentCart.revision + 1,
        };
        return currentCart;
      },
      async cancel(locationId, cartId, config) {
        assertCartScope(locationId, cartId);
        assertRevision(currentCart, config);
        appliedRewardId = undefined;
        currentCart = {
          ...fixtureCart,
          revision: currentCart.revision + 1,
        };
        return currentCart;
      },
      async ledger(params): Promise<LoyaltyLedger> {
        if (availability === "unavailable") throw unavailableError();
        if (availability === "disabled") return { enabled: false };

        const entries = fixtureScenarios.loyalty.ledger.entries ?? [];
        const offsetMatch = params?.cursor?.match(
          /^fixture-loyalty-offset-(\d+)$/,
        );
        const offset = offsetMatch ? Number(offsetMatch[1]) : 0;
        const limit = params?.limit ?? 20;
        const nextOffset = offset + limit;
        return {
          ...fixtureScenarios.loyalty.ledger,
          entries: entries.slice(offset, nextOffset),
          nextCursor:
            nextOffset < entries.length
              ? `fixture-loyalty-offset-${nextOffset}`
              : undefined,
        };
      },
      claims: {
        async submit(payload): Promise<LoyaltyClaimSubmission> {
          if (availability === "unavailable") throw unavailableError();
          return {
            claimId: `fixture-claim-${payload.orderId}`,
            status: "pending",
            submittedAt: fixtureTimeline.now,
          };
        },
        async list(): Promise<{ claims: LoyaltyClaim[] }> {
          if (availability === "unavailable") throw unavailableError();
          return { claims: [...fixtureClaims] };
        },
      },
    },
  } satisfies StorefrontLoyaltyClient;

  return createStorefrontLoyaltyActions(
    client,
    {
      tenantId: runtime.config.tenantId,
      merchantSlug: runtime.config.merchantSlug,
      profileEnabled: runtime.config.capabilities.loyalty,
    },
    {
      setMerchantScope() {},
      clearCustomerToken() {},
    },
  );
}
