import type {
  CursorPage,
  PublicOrderDetail,
  PublicOrderSummary,
} from "@craveup/storefront-sdk";

import { fixtureCalendar, fixtureTimeline } from "./reference-now";

const fixtureOrderSummaries = [
  {
    id: "fixture-order-1234",
    shortId: "1234",
    restaurantDisplayName: "Your Restaurant",
    fulfillmentMethod: "delivery",
    fulfillmentIdentifier: "1 Example Street, Los Angeles",
    pickupType: "ASAP",
    orderTime: "18:30",
    orderDate: fixtureCalendar.cartOrderDate,
    totalQuantity: 2,
    currency: "usd",
    orderTotal: "26.10",
    status: "DELIVERED",
    createdAt: fixtureTimeline.primaryOrderCreatedAt,
  },
  {
    id: "fixture-order-1220",
    shortId: "1220",
    restaurantDisplayName: "Your Restaurant",
    fulfillmentMethod: "delivery",
    fulfillmentIdentifier: "2 Example Avenue, Los Angeles",
    pickupType: "LATER",
    orderTime: "12:15",
    orderDate: fixtureCalendar.secondaryOrderDate,
    totalQuantity: 4,
    currency: "usd",
    orderTotal: "48.75",
    status: "DELIVERED",
    createdAt: fixtureTimeline.secondaryOrderCreatedAt,
  },
  {
    id: "fixture-order-1198",
    shortId: "1198",
    restaurantDisplayName: "Your Restaurant",
    fulfillmentMethod: "takeout",
    fulfillmentIdentifier: "Pickup counter",
    pickupType: "ASAP",
    orderTime: "17:45",
    orderDate: fixtureCalendar.cancelledOrderDate,
    totalQuantity: 1,
    currency: "usd",
    orderTotal: "19.40",
    status: "CANCELLED",
    createdAt: fixtureTimeline.cancelledOrderCreatedAt,
  },
] satisfies PublicOrderSummary[];

export const fixtureOrderHistory = {
  items: fixtureOrderSummaries,
  nextCursor: null,
} satisfies CursorPage<PublicOrderSummary>;

export const fixturePrimaryOrderDetail = {
  ...fixtureOrderSummaries[0],
  partiallyRefunded: false,
  items: [
    {
      id: "fixture-order-line-mushroom-burger",
      name: "Mushroom burger",
      quantity: 1,
      price: "13.00",
      total: "14.00",
      discount: "0.00",
      specialInstructions: "",
      modifiers: [
        {
          groupName: "Choose a side",
          name: "Waffle fries",
          quantity: 1,
          price: "1.00",
        },
      ],
    },
    {
      id: "fixture-order-line-chocolate-malt",
      name: "Chocolate malt",
      quantity: 1,
      price: "6.00",
      total: "6.00",
      discount: "0.00",
      specialInstructions: "",
      modifiers: [],
    },
  ],
  pricing: {
    subtotal: "20.00",
    discount: "0.00",
    tax: "2.10",
    tip: "0.00",
    serviceFee: "1.00",
    fulfillmentFee: "3.00",
    enterpriseFee: "0.00",
    total: "26.10",
    refunded: "0.00",
    netPaid: "26.10",
  },
  deliveryInfo: {
    deliveryAddress: "1 Example Street, Los Angeles, CA 90012",
  },
  roomServiceInfo: null,
  tableServiceInfo: null,
  payment: {
    cardLast4: "4242",
    walletType: null,
    cardBrand: "Visa",
  },
  updatedAt: fixtureTimeline.primaryOrderUpdatedAt,
} satisfies PublicOrderDetail;

export const fixturePartiallyRefundedOrderDetail = {
  ...fixtureOrderSummaries[1],
  partiallyRefunded: true,
  items: [
    {
      id: "fixture-order-line-double-smash",
      name: "Double smash burger",
      quantity: 2,
      price: "12.50",
      total: "26.00",
      discount: "0.00",
      specialInstructions: "",
      modifiers: [
        {
          groupName: "Choose a side",
          name: "Waffle fries",
          quantity: 1,
          price: "1.00",
        },
      ],
    },
    {
      id: "fixture-order-line-crinkle-fries",
      name: "Crinkle fries",
      quantity: 2,
      price: "4.50",
      total: "14.00",
      discount: "0.00",
      specialInstructions: "Extra crisp",
      modifiers: [],
    },
  ],
  pricing: {
    subtotal: "40.00",
    discount: "0.00",
    tax: "4.00",
    tip: "0.00",
    serviceFee: "1.00",
    fulfillmentFee: "3.75",
    enterpriseFee: "0.00",
    total: "48.75",
    refunded: "10.00",
    netPaid: "38.75",
  },
  deliveryInfo: {
    deliveryAddress: "2 Example Avenue, Los Angeles, CA 90013",
  },
  roomServiceInfo: null,
  tableServiceInfo: null,
  payment: {
    cardLast4: "4242",
    walletType: null,
    cardBrand: "Visa",
  },
  updatedAt: fixtureTimeline.secondaryOrderCreatedAt,
} satisfies PublicOrderDetail;

export const fixtureCancelledOrderDetail = {
  ...fixtureOrderSummaries[2],
  partiallyRefunded: false,
  items: [
    {
      id: "fixture-order-line-cancelled-burger",
      name: "Crispy chicken sandwich",
      quantity: 1,
      price: "18.00",
      total: "18.00",
      discount: "0.00",
      specialInstructions: "",
      modifiers: [],
    },
  ],
  pricing: {
    subtotal: "18.00",
    discount: "0.00",
    tax: "1.40",
    tip: "0.00",
    serviceFee: "0.00",
    fulfillmentFee: "0.00",
    enterpriseFee: "0.00",
    total: "19.40",
    refunded: "19.40",
    netPaid: "0.00",
  },
  deliveryInfo: null,
  roomServiceInfo: null,
  tableServiceInfo: null,
  payment: null,
  updatedAt: fixtureTimeline.cancelledOrderCreatedAt,
} satisfies PublicOrderDetail;

export const fixtureOrderDetails = {
  [fixturePrimaryOrderDetail.id]: fixturePrimaryOrderDetail,
  [fixturePartiallyRefundedOrderDetail.id]:
    fixturePartiallyRefundedOrderDetail,
  [fixtureCancelledOrderDetail.id]: fixtureCancelledOrderDetail,
} satisfies Record<string, PublicOrderDetail>;
