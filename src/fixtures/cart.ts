import type {
  CartFees,
  CartItem,
  StorefrontCart,
} from "@craveup/storefront-sdk";

import { fixtureLocation } from "./location";
import { fixtureCalendar, fixtureTimeline } from "./reference-now";

const zeroMoney = {
  raw: "0.00",
  formatted: "$0.00",
} as const;

const fixtureCartItems = [
  {
    id: "mushroom-burger",
    productId: "mushroom-burger",
    name: "Mushroom burger",
    description: "Roasted mushrooms, melted cheese, house sauce.",
    imageUrl: "/assets/template/menu-item.svg",
    price: "13.00",
    priceFormatted: "$13.00",
    quantity: 1,
    total: "14.00",
    totalFormatted: "$14.00",
    discount: "0.00",
    discountFormatted: "$0.00",
    categoryId: "burgers",
    itemUnavailableAction: "remove_item",
    selections: [
      {
        id: "choose-a-side",
        name: "Choose a side",
        rule: { min: 0, max: 1 },
        items: [
          {
            id: "waffle-fries",
            name: "Waffle fries",
            price: "1.00",
            priceFormatted: "+$1.00",
            quantity: 1,
          },
        ],
      },
    ],
  },
  {
    id: "chocolate-malt",
    productId: "chocolate-malt",
    name: "Chocolate malt",
    description: "Thick vanilla malt, spoon required.",
    imageUrl: "/assets/template/menu-item.svg",
    price: "6.00",
    priceFormatted: "$6.00",
    quantity: 1,
    total: "6.00",
    totalFormatted: "$6.00",
    discount: "0.00",
    discountFormatted: "$0.00",
    categoryId: "drinks",
    itemUnavailableAction: "remove_item",
    selections: [],
  },
] satisfies CartItem[];

const deliveryFees = {
  enterpriseFeeRate: "0.00",
  enterpriseFeeFix: "0.00",
  serviceFeeRate: "0.00",
  serviceFeeFix: "0.00",
  taxRate: "0.105",
  tipRate: "0.00",
  fulfillmentMethodFeeFix: "4.00",
  fulfillmentMethodFeeRate: "0.00",
  paymentProcessingFeeRate: "0.00",
  paymentProcessingFeeFix: "0.00",
} satisfies CartFees;

const noFulfillmentFee = {
  ...deliveryFees,
  fulfillmentMethodFeeFix: "0.00",
} satisfies CartFees;

const baseMoney = {
  subTotal: "20.00",
  subTotalFormatted: "$20.00",
  discountTotal: zeroMoney.raw,
  discountTotalFormatted: zeroMoney.formatted,
  waiterTipTotal: zeroMoney.raw,
  waiterTipTotalFormatted: zeroMoney.formatted,
  taxTotal: "2.10",
  taxTotalFormatted: "$2.10",
  taxAndFeeTotal: "6.10",
  taxAndFeeTotalFormatted: "$6.10",
  serviceFeeTotal: zeroMoney.raw,
  serviceFeeTotalFormatted: zeroMoney.formatted,
  paymentProcessingFeeTotal: zeroMoney.raw,
  paymentProcessingFeeTotalFormatted: zeroMoney.formatted,
  applicationFeeTotal: zeroMoney.raw,
  applicationFeeTotalFormatted: zeroMoney.formatted,
  netSalesTotal: "20.00",
  netSalesTotalFormatted: "$20.00",
  fulfillmentMethodFeeTotal: "4.00",
  fulfillmentMethodFeeTotalFormatted: "$4.00",
  orderTotal: "26.10",
  orderTotalFormatted: "$26.10",
  orderTotalWithServiceFee: "26.10",
  orderTotalWithServiceFeeFormatted: "$26.10",
  orderTotalWithServiceFeeAmount: 2610,
  enterpriseFeeTotal: zeroMoney.raw,
  enterpriseFeeTotalFormatted: zeroMoney.formatted,
  subTotalWithoutDiscount: "20.00",
  subTotalWithoutDiscountFormatted: "$20.00",
} as const;

export const fixtureCart = {
  id: "fixture-cart-demo",
  locationId: fixtureLocation.id,
  merchantId: "fixture-merchant",
  status: "OPEN",
  lockedAt: null,
  revision: 1,
  expiresAt: fixtureTimeline.cartExpiresAt,
  restaurantDisplayName: fixtureLocation.restaurantDisplayName,
  fulfilmentMethod: "delivery",
  fulfillmentIdentifier: "1 Example Street, Los Angeles",
  metadata: { source: "canonical-offline-fixture" },
  pickupType: "ASAP",
  orderDate: fixtureCalendar.cartOrderDate,
  orderTime: "18:30",
  currency: "usd",
  ...baseMoney,
  statementDescriptor: "CRAVE FIXTURE",
  totalQuantity: 2,
  items: fixtureCartItems,
  fees: deliveryFees,
  deliveryInfo: {
    addressString: "1 Example Street, Los Angeles",
    addressData: {
      street: "1 Example Street",
      streetOptional: "",
      city: "Los Angeles",
      state: "CA",
      zipCode: "90012",
      country: "United States",
      lat: 34.0522,
      lng: -118.2437,
    },
  },
  tableServiceInfo: null,
  roomServiceInfo: null,
} satisfies StorefrontCart;

export const fixturePickupCart = {
  ...fixtureCart,
  id: "fixture-cart-pickup",
  fulfilmentMethod: "takeout",
  fulfillmentIdentifier: "Pickup counter",
  taxAndFeeTotal: "2.10",
  taxAndFeeTotalFormatted: "$2.10",
  fulfillmentMethodFeeTotal: zeroMoney.raw,
  fulfillmentMethodFeeTotalFormatted: zeroMoney.formatted,
  orderTotal: "22.10",
  orderTotalFormatted: "$22.10",
  orderTotalWithServiceFee: "22.10",
  orderTotalWithServiceFeeFormatted: "$22.10",
  orderTotalWithServiceFeeAmount: 2210,
  fees: noFulfillmentFee,
  deliveryInfo: null,
} satisfies StorefrontCart;

export const fixtureCartQuantityUpdated = {
  ...fixtureCart,
  revision: 2,
  subTotal: "34.00",
  subTotalFormatted: "$34.00",
  taxTotal: "3.57",
  taxTotalFormatted: "$3.57",
  taxAndFeeTotal: "7.57",
  taxAndFeeTotalFormatted: "$7.57",
  netSalesTotal: "34.00",
  netSalesTotalFormatted: "$34.00",
  orderTotal: "41.57",
  orderTotalFormatted: "$41.57",
  orderTotalWithServiceFee: "41.57",
  orderTotalWithServiceFeeFormatted: "$41.57",
  orderTotalWithServiceFeeAmount: 4157,
  subTotalWithoutDiscount: "34.00",
  subTotalWithoutDiscountFormatted: "$34.00",
  totalQuantity: 3,
  items: fixtureCartItems.map((item, index) =>
    index === 0
      ? {
          ...item,
          quantity: 2,
          total: "28.00",
          totalFormatted: "$28.00",
        }
      : item,
  ),
} satisfies StorefrontCart;

export const fixturePickupCartQuantityUpdated = {
  ...fixtureCartQuantityUpdated,
  id: fixturePickupCart.id,
  fulfilmentMethod: "takeout",
  fulfillmentIdentifier: "Pickup counter",
  taxAndFeeTotal: "3.57",
  taxAndFeeTotalFormatted: "$3.57",
  fulfillmentMethodFeeTotal: zeroMoney.raw,
  fulfillmentMethodFeeTotalFormatted: zeroMoney.formatted,
  orderTotal: "37.57",
  orderTotalFormatted: "$37.57",
  orderTotalWithServiceFee: "37.57",
  orderTotalWithServiceFeeFormatted: "$37.57",
  orderTotalWithServiceFeeAmount: 3757,
  fees: noFulfillmentFee,
  deliveryInfo: null,
} satisfies StorefrontCart;

export const fixtureCartAfterMushroomRemoval = {
  ...fixtureCart,
  revision: 2,
  subTotal: "6.00",
  subTotalFormatted: "$6.00",
  taxTotal: "0.63",
  taxTotalFormatted: "$0.63",
  taxAndFeeTotal: "4.63",
  taxAndFeeTotalFormatted: "$4.63",
  netSalesTotal: "6.00",
  netSalesTotalFormatted: "$6.00",
  orderTotal: "10.63",
  orderTotalFormatted: "$10.63",
  orderTotalWithServiceFee: "10.63",
  orderTotalWithServiceFeeFormatted: "$10.63",
  orderTotalWithServiceFeeAmount: 1063,
  subTotalWithoutDiscount: "6.00",
  subTotalWithoutDiscountFormatted: "$6.00",
  totalQuantity: 1,
  items: [fixtureCartItems[1]],
} satisfies StorefrontCart;

export const fixturePickupCartAfterMushroomRemoval = {
  ...fixtureCartAfterMushroomRemoval,
  id: fixturePickupCart.id,
  fulfilmentMethod: "takeout",
  fulfillmentIdentifier: "Pickup counter",
  taxAndFeeTotal: "0.63",
  taxAndFeeTotalFormatted: "$0.63",
  fulfillmentMethodFeeTotal: zeroMoney.raw,
  fulfillmentMethodFeeTotalFormatted: zeroMoney.formatted,
  orderTotal: "6.63",
  orderTotalFormatted: "$6.63",
  orderTotalWithServiceFee: "6.63",
  orderTotalWithServiceFeeFormatted: "$6.63",
  orderTotalWithServiceFeeAmount: 663,
  fees: noFulfillmentFee,
  deliveryInfo: null,
} satisfies StorefrontCart;

export const fixtureCartAfterChocolateRemoval = {
  ...fixtureCart,
  revision: 2,
  subTotal: "14.00",
  subTotalFormatted: "$14.00",
  taxTotal: "1.47",
  taxTotalFormatted: "$1.47",
  taxAndFeeTotal: "5.47",
  taxAndFeeTotalFormatted: "$5.47",
  netSalesTotal: "14.00",
  netSalesTotalFormatted: "$14.00",
  orderTotal: "19.47",
  orderTotalFormatted: "$19.47",
  orderTotalWithServiceFee: "19.47",
  orderTotalWithServiceFeeFormatted: "$19.47",
  orderTotalWithServiceFeeAmount: 1947,
  subTotalWithoutDiscount: "14.00",
  subTotalWithoutDiscountFormatted: "$14.00",
  totalQuantity: 1,
  items: [fixtureCartItems[0]],
} satisfies StorefrontCart;

export const fixturePickupCartAfterChocolateRemoval = {
  ...fixtureCartAfterChocolateRemoval,
  id: fixturePickupCart.id,
  fulfilmentMethod: "takeout",
  fulfillmentIdentifier: "Pickup counter",
  taxAndFeeTotal: "1.47",
  taxAndFeeTotalFormatted: "$1.47",
  fulfillmentMethodFeeTotal: zeroMoney.raw,
  fulfillmentMethodFeeTotalFormatted: zeroMoney.formatted,
  orderTotal: "15.47",
  orderTotalFormatted: "$15.47",
  orderTotalWithServiceFee: "15.47",
  orderTotalWithServiceFeeFormatted: "$15.47",
  orderTotalWithServiceFeeAmount: 1547,
  fees: noFulfillmentFee,
  deliveryInfo: null,
} satisfies StorefrontCart;

export const fixtureTablesideCart = {
  ...fixturePickupCart,
  id: "fixture-cart-tableside",
  fulfilmentMethod: "table_side",
  fulfillmentIdentifier: "12",
  tableServiceInfo: { tableNumber: "12" },
} satisfies StorefrontCart;

export const fixtureRoomServiceCart = {
  ...fixturePickupCart,
  id: "fixture-cart-room-service",
  fulfilmentMethod: "room_service",
  fulfillmentIdentifier: "Room 324",
  taxAndFeeTotal: "5.70",
  taxAndFeeTotalFormatted: "$5.70",
  fulfillmentMethodFeeTotal: "3.60",
  fulfillmentMethodFeeTotalFormatted: "$3.60",
  orderTotal: "25.70",
  orderTotalFormatted: "$25.70",
  orderTotalWithServiceFee: "25.70",
  orderTotalWithServiceFeeFormatted: "$25.70",
  orderTotalWithServiceFeeAmount: 2570,
  fees: {
    ...noFulfillmentFee,
    fulfillmentMethodFeeFix: "3.60",
  },
  roomServiceInfo: { lastName: "Lee", roomNumber: "324" },
} satisfies StorefrontCart;

export const fixtureCartTipped = {
  ...fixtureCart,
  id: "fixture-cart-tipped",
  waiterTipTotal: "3.60",
  waiterTipTotalFormatted: "$3.60",
  orderTotal: "29.70",
  orderTotalFormatted: "$29.70",
  orderTotalWithServiceFee: "29.70",
  orderTotalWithServiceFeeFormatted: "$29.70",
  orderTotalWithServiceFeeAmount: 2970,
  fees: { ...deliveryFees, tipRate: "0.18" },
} satisfies StorefrontCart;

export const fixtureDiscountedCart = {
  ...fixtureCart,
  id: "fixture-cart-discounted",
  subTotal: "18.00",
  subTotalFormatted: "$18.00",
  discountTotal: "2.00",
  discountTotalFormatted: "$2.00",
  taxTotal: "1.89",
  taxTotalFormatted: "$1.89",
  taxAndFeeTotal: "5.89",
  taxAndFeeTotalFormatted: "$5.89",
  netSalesTotal: "18.00",
  netSalesTotalFormatted: "$18.00",
  orderTotal: "23.89",
  orderTotalFormatted: "$23.89",
  orderTotalWithServiceFee: "23.89",
  orderTotalWithServiceFeeFormatted: "$23.89",
  orderTotalWithServiceFeeAmount: 2389,
  discountCode: "FIXTURE2",
  items: fixtureCartItems.map((item, index) =>
    index === 0
      ? {
          ...item,
          total: "12.00",
          totalFormatted: "$12.00",
          discount: "2.00",
          discountFormatted: "$2.00",
        }
      : item,
  ),
} satisfies StorefrontCart;

export const fixtureEmptyCart = {
  ...fixturePickupCart,
  id: "fixture-cart-empty",
  subTotal: zeroMoney.raw,
  subTotalFormatted: zeroMoney.formatted,
  taxTotal: zeroMoney.raw,
  taxTotalFormatted: zeroMoney.formatted,
  taxAndFeeTotal: zeroMoney.raw,
  taxAndFeeTotalFormatted: zeroMoney.formatted,
  netSalesTotal: zeroMoney.raw,
  netSalesTotalFormatted: zeroMoney.formatted,
  orderTotal: zeroMoney.raw,
  orderTotalFormatted: zeroMoney.formatted,
  orderTotalWithServiceFee: zeroMoney.raw,
  orderTotalWithServiceFeeFormatted: zeroMoney.formatted,
  orderTotalWithServiceFeeAmount: 0,
  subTotalWithoutDiscount: zeroMoney.raw,
  subTotalWithoutDiscountFormatted: zeroMoney.formatted,
  totalQuantity: 0,
  items: [],
} satisfies StorefrontCart;

export const fixtureExpiredCart = {
  ...fixtureCart,
  id: "fixture-cart-expired",
  status: "EXPIRED",
  revision: 2,
  expiresAt: fixtureTimeline.expiredCartExpiresAt,
} satisfies StorefrontCart;

export const fixtureFulfillmentCarts = {
  delivery: fixtureCart,
  pickup: fixturePickupCart,
  tableside: fixtureTablesideCart,
  roomService: fixtureRoomServiceCart,
} satisfies Record<string, StorefrontCart>;
