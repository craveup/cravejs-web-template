import type { StorefrontCart } from "@craveup/storefront-sdk";

import { isStorefrontRevision } from "./action-input";

export interface ExpectedStorefrontCartResponse {
  readonly locationId: string;
  readonly cartId: string;
  readonly revision: number;
}

export interface StorefrontCartResponseIssue {
  readonly code:
    | "CART_SCOPE_MISMATCH"
    | "CART_REVISION_INVALID"
    | "CART_REVISION_REGRESSED";
  readonly message: string;
}

export function storefrontCartReadIssue(
  expected: ExpectedStorefrontCartResponse,
  cart: StorefrontCart,
): StorefrontCartResponseIssue | undefined {
  if (cart.id !== expected.cartId || cart.locationId !== expected.locationId) {
    return {
      code: "CART_SCOPE_MISMATCH",
      message: "The refreshed cart does not match this ordering session.",
    };
  }
  if (!isStorefrontRevision(cart.revision)) {
    return {
      code: "CART_REVISION_INVALID",
      message: "The refreshed cart revision is invalid.",
    };
  }
  if (cart.revision < expected.revision) {
    return {
      code: "CART_REVISION_REGRESSED",
      message: "The refreshed cart revision is stale.",
    };
  }
  return undefined;
}
