import type { OrderTimeState } from "@/features/fulfillment/time/order-time-picker";

const english = {
  back: "Back to checkout",
  title: "Schedule your order",
  defaultClosed: "The store is closed right now. Choose a returned time.",
  noTimes: "No order times are available.",
  pickupTiming: "Pickup timing",
  asap: "As soon as possible",
  orderDays: "Order days",
  availableTimes: "Available times",
  noReturnedTimes: "No returned times for this day.",
  unavailable: "Unavailable",
  cancel: "Cancel",
  changePickupTime: (summary: string) => `Change pickup time, currently ${summary}`,
  reloadOrderTimes: "Reload order times",
  confirming: "Confirming…",
  chooseTime: "Choose an order time",
  confirm: (label: string) => `Confirm ${label}`,
  retrySelection: (label: string) => `Try ${label} again`,
  retryIn: (seconds: number) => `Try again in ${seconds}s`,
  missingSlot: "That order time is no longer available. Choose another returned time.",
  missingCart: "The updated order could not be confirmed. Refresh and try again.",
  updateFailed: "The order time could not be updated. Try again.",
  state: {
    conflict: "The order changed elsewhere. Review the refreshed order, then retry this time.",
    expired: "This order has expired. Return to the menu and start a new order.",
    immutable: "This order time can no longer be changed.",
    "rate-limited": "Order-time updates are temporarily rate limited.",
    processing: "Your order-time update is still processing. Retry to check its result.",
    unavailable: "Order-time updates are temporarily unavailable.",
    closed: "The store cannot accept that time. Choose another returned time.",
    error: "The order time could not be updated. Try again.",
  } satisfies Partial<Record<OrderTimeState, string>>,
} as const;

export function getCheckoutSchedulingMessages(locale: string) {
  const messagesByLocale: Readonly<Record<string, typeof english>> = {
    "en-US": english,
  };
  return messagesByLocale[locale] ?? english;
}
