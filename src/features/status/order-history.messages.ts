export interface OrderHistoryMessages {
  readonly heading: string;
  readonly loadingOrders: string;
  readonly emptyHeading: string;
  readonly emptyDescription: string;
  readonly browseMenu: string;
  readonly signInHeading: string;
  readonly signInDescription: string;
  readonly signIn: string;
  readonly ordersUnavailableHeading: string;
  readonly ordersUnavailableDescription: string;
  readonly tryAgain: string;
  readonly tryAgainIn: (seconds: number) => string;
  readonly viewOrder: string;
  readonly loadMore: string;
  readonly loadingMore: string;
  readonly paginationError: string;
  readonly paginationRateLimited: string;
  readonly orderHeading: (shortId: string) => string;
  readonly backToOrders: string;
  readonly orderUnavailableHeading: string;
  readonly orderUnavailableDescription: string;
  readonly partiallyRefunded: string;
  readonly itemsHeading: string;
  readonly itemCount: (count: number) => string;
  readonly quantity: (count: number) => string;
  readonly orderSummaryHeading: string;
  readonly subtotal: string;
  readonly discount: string;
  readonly tax: string;
  readonly tip: string;
  readonly serviceFee: string;
  readonly fulfillmentFee: string;
  readonly enterpriseFee: string;
  readonly total: string;
  readonly refunded: string;
  readonly netPaid: string;
  readonly deliveryHeading: string;
  readonly paymentHeading: string;
  readonly paymentCard: (brand: string, last4: string) => string;
  readonly paymentWallet: (wallet: string) => string;
}

const enUsOrderHistoryMessages: OrderHistoryMessages = {
  heading: "Your orders",
  loadingOrders: "Loading orders…",
  emptyHeading: "No orders yet",
  emptyDescription: "Orders placed while signed in will appear here.",
  browseMenu: "Browse the menu",
  signInHeading: "Sign in to see your orders",
  signInDescription: "Your order history is linked to your customer account.",
  signIn: "Sign in",
  ordersUnavailableHeading: "Orders unavailable",
  ordersUnavailableDescription: "We couldn't load your orders. Please try again.",
  tryAgain: "Try again",
  tryAgainIn: (seconds) =>
    `Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}`,
  viewOrder: "View order",
  loadMore: "Load more orders",
  loadingMore: "Loading more orders…",
  paginationError: "We couldn't load more orders. Try again.",
  paginationRateLimited: "Please wait before loading more orders.",
  orderHeading: (shortId) => `Order #${shortId}`,
  backToOrders: "Back to your orders",
  orderUnavailableHeading: "Order unavailable",
  orderUnavailableDescription:
    "This order can't be displayed. Return to your order history and try again.",
  partiallyRefunded: "Partially refunded",
  itemsHeading: "Items",
  itemCount: (count) => `${count} ${count === 1 ? "item" : "items"}`,
  quantity: (count) => `Quantity ${count}`,
  orderSummaryHeading: "Order summary",
  subtotal: "Subtotal",
  discount: "Discount",
  tax: "Tax",
  tip: "Tip",
  serviceFee: "Service fee",
  fulfillmentFee: "Fulfillment fee",
  enterpriseFee: "Enterprise fee",
  total: "Total",
  refunded: "Refunded",
  netPaid: "Net paid",
  deliveryHeading: "Delivery",
  paymentHeading: "Payment",
  paymentCard: (brand, last4) => `${brand} ending in ${last4}`,
  paymentWallet: (wallet) => wallet,
};

const messagesByLocale: Readonly<Record<string, OrderHistoryMessages>> = {
  "en-US": enUsOrderHistoryMessages,
};

export function getOrderHistoryMessages(locale: string): OrderHistoryMessages {
  return messagesByLocale[locale] ?? enUsOrderHistoryMessages;
}
