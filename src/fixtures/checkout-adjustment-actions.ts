import type {
  StorefrontCart,
  UpdateGratuityPayload,
} from "@craveup/storefront-sdk";

import {
  StorefrontCheckoutAdjustmentError,
  type StorefrontCheckoutAdjustmentActions,
} from "@/lib/storefront/checkout-adjustment-actions";
import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "@/lib/storefront/action-input";

import { fixtureDiscountedCart, fixturePickupCart } from "./cart";

type TipKey = "none" | "15" | "18" | "20";

const tipValues = {
  none: {
    raw: "0.00",
    formatted: "$0.00",
    rate: "0.00",
    regularTotal: "22.10",
    regularFormatted: "$22.10",
    regularAmount: 2210,
    discountedTotal: "19.89",
    discountedFormatted: "$19.89",
    discountedAmount: 1989,
  },
  "15": {
    raw: "3.00",
    formatted: "$3.00",
    rate: "0.15",
    regularTotal: "25.10",
    regularFormatted: "$25.10",
    regularAmount: 2510,
    discountedTotal: "22.89",
    discountedFormatted: "$22.89",
    discountedAmount: 2289,
  },
  "18": {
    raw: "3.60",
    formatted: "$3.60",
    rate: "0.18",
    regularTotal: "25.70",
    regularFormatted: "$25.70",
    regularAmount: 2570,
    discountedTotal: "23.49",
    discountedFormatted: "$23.49",
    discountedAmount: 2349,
  },
  "20": {
    raw: "4.00",
    formatted: "$4.00",
    rate: "0.20",
    regularTotal: "26.10",
    regularFormatted: "$26.10",
    regularAmount: 2610,
    discountedTotal: "23.89",
    discountedFormatted: "$23.89",
    discountedAmount: 2389,
  },
} as const;

function validation(message: string) {
  return new StorefrontCheckoutAdjustmentError({
    state: "validation",
    code: "VALIDATION_ERROR",
    message,
  });
}

function tipKey(payload: UpdateGratuityPayload): TipKey {
  if ("percentage" in payload) {
    if (payload.percentage === "15" || payload.percentage === "18" || payload.percentage === "20") {
      return payload.percentage;
    }
    throw validation("The fixture gratuity percentage is unavailable.");
  }
  if (payload.amount === "0" || payload.amount === "0.00") return "none";
  if (payload.amount === "3.00") return "15";
  if (payload.amount === "3.60") return "18";
  if (payload.amount === "4.00") return "20";
  throw validation("Use a canonical fixture gratuity amount.");
}

function selectedTip(cart: StorefrontCart): TipKey {
  if (cart.waiterTipTotal === "3.00") return "15";
  if (cart.waiterTipTotal === "3.60") return "18";
  if (cart.waiterTipTotal === "4.00") return "20";
  return "none";
}

function adjustedCart(
  current: StorefrontCart,
  tip: TipKey,
  discounted: boolean,
): StorefrontCart {
  const source = discounted ? fixtureDiscountedCart : fixturePickupCart;
  const value = tipValues[tip];
  const total = discounted ? value.discountedTotal : value.regularTotal;
  const formattedTotal = discounted
    ? value.discountedFormatted
    : value.regularFormatted;
  const amount = discounted ? value.discountedAmount : value.regularAmount;
  return {
    ...source,
    id: current.id,
    locationId: current.locationId,
    merchantId: current.merchantId,
    restaurantDisplayName: current.restaurantDisplayName,
    fulfilmentMethod: current.fulfilmentMethod,
    fulfillmentIdentifier: current.fulfillmentIdentifier,
    deliveryInfo: current.deliveryInfo,
    tableServiceInfo: current.tableServiceInfo,
    roomServiceInfo: current.roomServiceInfo,
    pickupType: current.pickupType,
    orderDate: current.orderDate,
    orderTime: current.orderTime,
    waiterTipTotal: value.raw,
    waiterTipTotalFormatted: value.formatted,
    fulfillmentMethodFeeTotal: "0.00",
    fulfillmentMethodFeeTotalFormatted: "$0.00",
    taxAndFeeTotal: discounted ? "1.89" : "2.10",
    taxAndFeeTotalFormatted: discounted ? "$1.89" : "$2.10",
    orderTotal: total,
    orderTotalFormatted: formattedTotal,
    orderTotalWithServiceFee: total,
    orderTotalWithServiceFeeFormatted: formattedTotal,
    orderTotalWithServiceFeeAmount: amount,
    fees: { ...current.fees, tipRate: value.rate },
    revision: current.revision + 1,
  };
}

export function createFixtureCheckoutAdjustmentActions(
  initialCart: StorefrontCart,
): StorefrontCheckoutAdjustmentActions {
  function requireInput(input: Readonly<{
    locationId: string;
    cartId: string;
    revision: number;
    idempotencyKey: string;
  }>) {
    if (
      input.locationId !== initialCart.locationId ||
      input.cartId !== initialCart.id ||
      input.revision !== initialCart.revision ||
      !isStorefrontRevision(input.revision) ||
      !isStorefrontIdempotencyKey(input.idempotencyKey)
    ) {
      throw validation("The fixture checkout adjustment request is invalid.");
    }
  }
  return {
    async updateGratuity(input) {
      requireInput(input);
      return {
        state: "succeeded",
        cart: adjustedCart(initialCart, tipKey(input.payload), Boolean(initialCart.discountCode)),
      };
    },
    async applyDiscount(input) {
      requireInput(input);
      if (input.code !== "FIXTURE2") {
        throw validation("The fixture discount code is invalid.");
      }
      return {
        state: "succeeded",
        cart: adjustedCart(initialCart, selectedTip(initialCart), true),
      };
    },
    async removeDiscount(input) {
      requireInput(input);
      return {
        state: "succeeded",
        cart: adjustedCart(initialCart, selectedTip(initialCart), false),
      };
    },
  };
}
