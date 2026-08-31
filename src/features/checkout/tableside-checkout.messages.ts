import type { TablesidePreflightResult } from "./tableside-preflight";

type BlockReason = Extract<
  TablesidePreflightResult,
  { state: "blocked" }
>["reason"];

const blockedCopy: Record<BlockReason, string> = {
  "missing-cart":
    "Your order session is no longer available. Return to the menu to start again.",
  empty: "Your order is empty. Add an item before checkout.",
  expired: "Your order has expired. Return to the menu to start a new order.",
  immutable: "This order can no longer be changed or checked out.",
  completed: "This order has already been completed.",
  stale: "Your order changed. Review the refreshed cart before continuing.",
  "authentication-required":
    "Your verified session expired. Verify your number again to continue.",
  "missing-table":
    "Your table is missing from the current order. Confirm the table before continuing.",
  "mismatched-table":
    "Your table changed. Review the current table before continuing.",
  "incomplete-schedule":
    "Your order time is incomplete. Review the cart before continuing.",
};

const englishMessages = {
  title: "Checkout",
  loading: "Validating your tableside order\u2026",
  retry: "Try again",
  retryAfter: (seconds: number) => `Try again in ${seconds}s`,
  rateLimited: "Checkout validation is temporarily rate limited.",
  pending: "Checkout validation is still finishing.",
  validationFailed: "Checkout details could not be validated.",
  reviewCart: "Review your cart",
  previewLabel: "Tableside checkout preview",
  previewNote:
    "Table assignment after hosted checkout is not yet confirmed by the completed-order contract.",
  orderingAt: "Ordering at",
  tableLabel: (tableIdentifier: string) => `Table ${tableIdentifier}`,
  change: "Change",
  cartSummary: "Cart summary",
  orderSummary: "Order summary",
  subtotal: "Subtotal",
  discount: (code: string) => `Discount \u00b7 ${code}`,
  tip: "Tip",
  taxesAndFees: "Taxes & fees",
  total: "Total",
  startOwnTab: "Start my own tab",
  block: (reason: BlockReason) => blockedCopy[reason],
} as const;

export function getTablesideCheckoutMessages(_locale: string) {
  void _locale;
  return englishMessages;
}
