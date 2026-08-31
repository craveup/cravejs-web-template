import type { PublicOrderDetail } from "@craveup/storefront-sdk";

import { fixturePrimaryOrderDetail } from "./orders";

export const fixtureReceiptId = "fixture-receipt-1234" as const;

export const fixtureReceipt = {
  ...fixturePrimaryOrderDetail,
  items: fixturePrimaryOrderDetail.items.map((item) => ({
    ...item,
    modifiers: item.modifiers.map((modifier) => ({ ...modifier })),
  })),
  pricing: { ...fixturePrimaryOrderDetail.pricing },
  deliveryInfo: fixturePrimaryOrderDetail.deliveryInfo
    ? { ...fixturePrimaryOrderDetail.deliveryInfo }
    : null,
  payment: fixturePrimaryOrderDetail.payment
    ? { ...fixturePrimaryOrderDetail.payment }
    : null,
} satisfies PublicOrderDetail;

export const fixturePickupReceiptId = "fixture-receipt-pickup-b4k9" as const;

export const fixturePickupReceipt = {
  ...fixtureReceipt,
  id: "fixture-order-pickup-b4k9",
  shortId: "1235",
  fulfillmentMethod: "takeout",
  fulfillmentIdentifier: "B4K9",
  orderTotal: "22.10",
  pricing: {
    ...fixtureReceipt.pricing,
    serviceFee: "0.00",
    fulfillmentFee: "0.00",
    total: "22.10",
    netPaid: "22.10",
  },
  deliveryInfo: null,
} satisfies PublicOrderDetail;
