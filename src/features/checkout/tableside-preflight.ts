import type { StorefrontCart, StorefrontCustomer } from "@craveup/storefront-sdk";

import {
  runCheckoutPreflight,
  type CheckoutPreflightClient,
  type CheckoutPreflightResult,
} from "./checkout-preflight";

export type TablesidePreflightBlock =
  | "missing-table"
  | "mismatched-table"
  | "incomplete-schedule";

export type TablesidePreflightResult = CheckoutPreflightResult<
  TablesidePreflightBlock
>;

function tablesideBlock(
  cart: StorefrontCart,
  expectedTableIdentifier: string,
): TablesidePreflightBlock | null {
  const tableIdentifier = cart.tableServiceInfo?.tableNumber?.trim() ?? "";
  const fulfillmentIdentifier = cart.fulfillmentIdentifier.trim();
  if (
    cart.fulfilmentMethod !== "table_side" ||
    !tableIdentifier ||
    !fulfillmentIdentifier
  ) {
    return "missing-table";
  }
  if (
    tableIdentifier !== expectedTableIdentifier
  ) {
    return "mismatched-table";
  }
  if (!cart.orderDate || !cart.orderTime) return "incomplete-schedule";
  return null;
}

export function runTablesidePreflight(
  client: CheckoutPreflightClient,
  input: Readonly<{
    locationId: string;
    cartId: string;
    customer: StorefrontCustomer;
    orderName?: string;
    expectedTableIdentifier: string;
    idempotencyKey: string;
    expectedRevision?: number;
    replay?: boolean;
  }>,
): Promise<TablesidePreflightResult> {
  const expectedTableIdentifier = input.expectedTableIdentifier.trim();
  return runCheckoutPreflight(client, {
    ...input,
    incompleteCustomerReason: "missing-table",
    validateCart: (cart) =>
      tablesideBlock(cart, expectedTableIdentifier),
  });
}
