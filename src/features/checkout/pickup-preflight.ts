import type { StorefrontCart, StorefrontCustomer } from "@craveup/storefront-sdk";

import {
  runCheckoutPreflight,
  type CheckoutPreflightClient,
  type CheckoutPreflightResult,
} from "./checkout-preflight";

export type PickupPreflightBlock =
  | "missing-cart"
  | "empty"
  | "expired"
  | "immutable"
  | "completed"
  | "stale"
  | "authentication-required"
  | "incomplete-fulfillment";

export type PickupPreflightResult = CheckoutPreflightResult<
  "incomplete-fulfillment"
>;

function pickupBlock(cart: StorefrontCart): "incomplete-fulfillment" | null {
  if (cart.fulfilmentMethod !== "takeout") return "incomplete-fulfillment";
  if (!cart.orderDate || !cart.orderTime) return "incomplete-fulfillment";
  return null;
}

export async function runPickupPreflight(
  client: CheckoutPreflightClient,
  input: Readonly<{
    locationId: string;
    cartId: string;
    customer: StorefrontCustomer;
    orderName?: string;
    idempotencyKey: string;
    expectedRevision?: number;
    replay?: boolean;
  }>,
): Promise<PickupPreflightResult> {
  return runCheckoutPreflight(client, {
    ...input,
    incompleteCustomerReason: "incomplete-fulfillment",
    validateCart: pickupBlock,
  });
}
