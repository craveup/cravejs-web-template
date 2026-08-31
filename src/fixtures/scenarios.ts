import type {
  LoyaltyLedger,
  LoyaltyQuote,
  OrderResult,
  StorefrontCart,
} from "@craveup/storefront-sdk";

import {
  fixtureCart,
  fixtureCartTipped,
  fixtureDiscountedCart,
  fixtureEmptyCart,
  fixtureExpiredCart,
  fixtureFulfillmentCarts,
} from "./cart";
import { fixtureCustomer, fixtureSavedAddresses } from "./customer";
import { fixturePrimaryOrderDetail } from "./orders";
import { fixtureTimeline } from "./reference-now";

const fixtureOrderResultValues = {
  paymentPending: { state: "payment_pending" },
  orderPending: { state: "order_pending" },
  completed: { state: "completed", order: fixturePrimaryOrderDetail },
  failed: { state: "failed", code: "PAYMENT_FAILED" },
} satisfies Record<string, OrderResult>;

const fixtureLoyaltyQuotes = {
  disabled: { enabled: false },
  unavailable: { enabled: true, available: false },
  enabled: {
    enabled: true,
    available: true,
    pointsToEarn: 26,
    balance: { posted: 640, reserved: 100, available: 540 },
    rewards: [
      {
        id: "fixture-reward-five-off",
        name: "$5 off",
        status: "available",
        pointsCost: 500,
        amountOff: 5,
        redeemable: true,
      },
    ],
  },
} satisfies Record<string, LoyaltyQuote>;

const fixtureLoyaltyLedger = {
  enabled: true,
  balances: [
    {
      unit: "points",
      label: "Points",
      posted: 640,
      reserved: 100,
      available: 540,
      asOf: fixtureTimeline.now,
    },
  ],
  entries: [
    {
      operation: "earn",
      amount: 26,
      unit: "points",
      classification: "order",
      orderReference: "1234",
      occurredAt: fixtureTimeline.loyaltyEntryOccurredAt,
    },
  ],
} satisfies LoyaltyLedger;

interface CanonicalFixtureScenarios {
  carts: {
    empty: StorefrontCart;
    populated: StorefrontCart;
    discounted: StorefrontCart;
    tipped: StorefrontCart;
    expired: StorefrontCart;
  };
  fulfillment: typeof fixtureFulfillmentCarts;
  catalog: {
    nestedModifierProductId: string;
    unavailableProductId: string;
  };
  customer: {
    anonymous: { state: "anonymous" };
    authenticated: { state: "authenticated"; merchantSlug: string };
    profile: typeof fixtureCustomer;
    addresses: typeof fixtureSavedAddresses;
  };
  checkout: Record<
    | "prepareFailure"
    | "prepareExpiry"
    | "wrongOrigin"
    | "navigationFailure"
    | "handedOff"
    | "unknownOutcome",
    Record<string, string>
  >;
  cartConflict: {
    code: "CART_CONFLICT";
    requestId: string;
    attemptedRevision: number;
    authoritativeRevision: number;
  };
  sessionRecovery: {
    existingCart: {
      cartId: string;
      requestedRevision: number;
      returnedRevision: number;
      guestAccess: "not-present";
    };
    claimed: {
      cartId: string;
      returnedRevision: number;
      ownership: "customer";
      guestAccess: "removed";
    };
  };
  orderResults: {
    gate: "gated";
    consumerContext: "unavailable";
    values: typeof fixtureOrderResultValues;
  };
  loyalty: {
    quotes: typeof fixtureLoyaltyQuotes;
    ledger: LoyaltyLedger;
    redeemedCart: StorefrontCart;
    cancelledCart: StorefrontCart;
    providerFailure: "isolated";
  };
  capabilities: {
    tableRoomPersistence: "partial";
    groupOrder: "cut";
    chargeToRoom: "cut";
    liveTracking: "cut";
    curbsideArrival: "cut";
  };
}

export const fixtureScenarios = {
  carts: {
    empty: fixtureEmptyCart,
    populated: fixtureCart,
    discounted: fixtureDiscountedCart,
    tipped: fixtureCartTipped,
    expired: fixtureExpiredCart,
  },
  fulfillment: fixtureFulfillmentCarts,
  catalog: {
    nestedModifierProductId: "double-smash-burger",
    unavailableProductId: "mushroom-burger",
  },
  customer: {
    anonymous: { state: "anonymous" },
    authenticated: { state: "authenticated", merchantSlug: "fixture-base" },
    profile: fixtureCustomer,
    addresses: fixtureSavedAddresses,
  },
  checkout: {
    prepareFailure: {
      state: "failed",
      code: "DEPENDENCY_UNAVAILABLE",
    },
    prepareExpiry: {
      state: "expired",
      expiresAt: fixtureTimeline.checkoutExpiredAt,
    },
    wrongOrigin: {
      state: "rejected",
      candidateOrigin: "https://untrusted.example.test",
    },
    navigationFailure: { state: "navigation-failed" },
    handedOff: { state: "handed-off" },
    unknownOutcome: { state: "outcome-unknown" },
  },
  cartConflict: {
    code: "CART_CONFLICT",
    requestId: "fixture-request-cart-conflict",
    attemptedRevision: 1,
    authoritativeRevision: 2,
  },
  sessionRecovery: {
    existingCart: {
      cartId: fixtureCart.id,
      requestedRevision: 1,
      returnedRevision: 2,
      guestAccess: "not-present",
    },
    claimed: {
      cartId: fixtureCart.id,
      returnedRevision: 3,
      ownership: "customer",
      guestAccess: "removed",
    },
  },
  orderResults: {
    gate: "gated",
    consumerContext: "unavailable",
    values: fixtureOrderResultValues,
  },
  loyalty: {
    quotes: fixtureLoyaltyQuotes,
    ledger: fixtureLoyaltyLedger,
    redeemedCart: fixtureDiscountedCart,
    cancelledCart: fixtureCart,
    providerFailure: "isolated",
  },
  capabilities: {
    tableRoomPersistence: "partial",
    groupOrder: "cut",
    chargeToRoom: "cut",
    liveTracking: "cut",
    curbsideArrival: "cut",
  },
} satisfies CanonicalFixtureScenarios;
