import type {
  RequestConfig,
  StorefrontCart,
  StorefrontCustomer,
  ValidateAndUpdateCustomerPayload,
} from "@craveup/storefront-sdk";

import { toStorefrontErrorState } from "@/lib/storefront/error-state";

export type CheckoutPreflightBaseBlock =
  | "missing-cart"
  | "empty"
  | "expired"
  | "immutable"
  | "completed"
  | "stale"
  | "authentication-required";

export type CheckoutPreflightResult<Reason extends string> =
  | Readonly<{ state: "ready"; cart: StorefrontCart }>
  | Readonly<{
      state: "blocked";
      reason: CheckoutPreflightBaseBlock | Reason;
      cart?: StorefrontCart;
    }>;

export interface CheckoutPreflightClient {
  readonly cart: {
    get(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    validateAndUpdateCustomer(
      locationId: string,
      cartId: string,
      payload: ValidateAndUpdateCustomerPayload,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
  };
}

function baseBlockForCart(
  cart: StorefrontCart,
  locationId: string,
  cartId: string,
): CheckoutPreflightBaseBlock | null {
  if (cart.locationId !== locationId || cart.id !== cartId) return "missing-cart";
  if (cart.status === "EXPIRED") return "expired";
  if (cart.status === "LOCKED") return "immutable";
  if (cart.status === "COMPLETED") return "completed";
  if (cart.items.length === 0 || cart.totalQuantity === 0) return "empty";
  return null;
}

function customerPayload(
  customer: StorefrontCustomer,
  orderName?: string,
): ValidateAndUpdateCustomerPayload | null {
  const customerName =
    orderName?.trim() ||
    [customer.customerName, customer.lastName].filter(Boolean).join(" ").trim();
  if (!customerName) return null;
  if (customer.phoneNumber) {
    return { customerName, phoneNumber: customer.phoneNumber };
  }
  if (customer.customerEmail) {
    return { customerName, emailAddress: customer.customerEmail };
  }
  return null;
}

export async function runCheckoutPreflight<Reason extends string>(
  client: CheckoutPreflightClient,
  input: Readonly<{
    locationId: string;
    cartId: string;
    customer: StorefrontCustomer;
    orderName?: string;
    idempotencyKey: string;
    expectedRevision?: number;
    replay?: boolean;
    incompleteCustomerReason: Reason;
    validateCart: (cart: StorefrontCart) => Reason | null;
  }>,
): Promise<CheckoutPreflightResult<Reason>> {
  let cart: StorefrontCart;
  try {
    cart = await client.cart.get(input.locationId, input.cartId);
  } catch (error) {
    const safe = toStorefrontErrorState(error);
    if (safe.state === "authentication-required") {
      return { state: "blocked", reason: "authentication-required" };
    }
    if (safe.state === "unavailable") {
      return { state: "blocked", reason: "missing-cart" };
    }
    throw error;
  }

  const baseBlock = baseBlockForCart(cart, input.locationId, input.cartId);
  if (baseBlock) return { state: "blocked", reason: baseBlock, cart };
  const initialBlock = input.validateCart(cart);
  if (initialBlock) return { state: "blocked", reason: initialBlock, cart };
  if (
    input.expectedRevision !== undefined &&
    !input.replay &&
    cart.revision !== input.expectedRevision
  ) {
    return { state: "blocked", reason: "stale", cart };
  }

  const payload = customerPayload(input.customer, input.orderName);
  if (!payload) {
    return {
      state: "blocked",
      reason: input.incompleteCustomerReason,
      cart,
    };
  }

  try {
    const validated = await client.cart.validateAndUpdateCustomer(
      input.locationId,
      input.cartId,
      payload,
      {
        revision: input.expectedRevision ?? cart.revision,
        idempotencyKey: input.idempotencyKey,
      },
    );
    const validatedBaseBlock = baseBlockForCart(
      validated,
      input.locationId,
      input.cartId,
    );
    if (validatedBaseBlock) {
      return { state: "blocked", reason: validatedBaseBlock, cart: validated };
    }
    const finalBlock = input.validateCart(validated);
    return finalBlock
      ? { state: "blocked", reason: finalBlock, cart: validated }
      : { state: "ready", cart: validated };
  } catch (error) {
    const safe = toStorefrontErrorState(error);
    if (safe.code === "CART_CONFLICT") {
      return { state: "blocked", reason: "stale", cart };
    }
    if (safe.code === "CART_IMMUTABLE") {
      return { state: "blocked", reason: "immutable", cart };
    }
    if (safe.code === "CART_EXPIRED") {
      return { state: "blocked", reason: "expired", cart };
    }
    if (safe.state === "authentication-required") {
      return { state: "blocked", reason: "authentication-required", cart };
    }
    throw error;
  }
}
