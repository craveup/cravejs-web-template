"use client";

import type { StorefrontCart, UpdateGratuityPayload } from "@craveup/storefront-sdk";
import { useMemo, useState } from "react";

import { StorefrontCheckoutAdjustmentError } from "@/lib/storefront/checkout-adjustment-actions";

import {
  CheckoutAdjustments,
  type CheckoutLoyaltyAdapter,
} from "./checkout-adjustments";
import {
  checkoutLoyaltyEnabled,
  mutateCheckoutAdjustment,
  mutateCheckoutLoyalty,
  quoteCheckoutLoyalty,
  type CheckoutAdjustmentRuntime,
} from "./checkout-adjustment-runtime";
import type { CheckoutGratuityState } from "./load-checkout-adjustment-config";

interface Attempt {
  readonly signature: string;
  readonly idempotencyKey: string;
}

function createAttemptKeys() {
  let current: Attempt | undefined;
  return {
    next(signature: string) {
      if (current?.signature !== signature) {
        current = { signature, idempotencyKey: globalThis.crypto.randomUUID() };
      }
      return current.idempotencyKey;
    },
    clear() {
      current = undefined;
    },
  };
}

function conflict(message: string, cart: StorefrontCart) {
  return new StorefrontCheckoutAdjustmentError({
    state: "cart-conflict",
    code: "CART_CONFLICT",
    message,
  }, cart);
}

export function ConnectedCheckoutAdjustments({
  gratuity,
  initialCart,
  runtime,
}: {
  readonly gratuity: CheckoutGratuityState;
  readonly initialCart: StorefrontCart;
  readonly runtime: CheckoutAdjustmentRuntime;
}) {
  const [adjustmentKeys] = useState(createAttemptKeys);
  const [loyaltyKeys] = useState(createAttemptKeys);
  const loyalty = useMemo<CheckoutLoyaltyAdapter | undefined>(() => {
    if (!checkoutLoyaltyEnabled(runtime)) return undefined;
    return {
      quote: (cart) => quoteCheckoutLoyalty(runtime, cart),
      async redeem(cart, rewardId) {
        const signature = JSON.stringify({ action: "redeem", rewardId });
        const result = await mutateCheckoutLoyalty({
          runtime,
          cart,
          action: { kind: "redeem", rewardId },
          idempotencyKey: loyaltyKeys.next(signature),
        });
        loyaltyKeys.clear();
        return result;
      },
      async cancel(cart) {
        const signature = JSON.stringify({ action: "cancel" });
        const result = await mutateCheckoutLoyalty({
          runtime,
          cart,
          action: { kind: "cancel" },
          idempotencyKey: loyaltyKeys.next(signature),
        });
        loyaltyKeys.clear();
        return result;
      },
    };
  }, [loyaltyKeys, runtime]);

  async function mutate(
    cart: StorefrontCart,
    adjustment:
      | Readonly<{ kind: "gratuity"; payload: UpdateGratuityPayload }>
      | Readonly<{ kind: "apply-discount"; code: string }>
      | Readonly<{ kind: "remove-discount" }>,
  ) {
    const signature = JSON.stringify(adjustment);
    const result = await mutateCheckoutAdjustment({
      runtime,
      cart,
      adjustment,
      idempotencyKey: adjustmentKeys.next(signature),
    });
    adjustmentKeys.clear();
    if (result.state === "retry-required") {
      throw conflict(result.error.message, result.cart);
    }
    return result.cart;
  }

  return (
    <CheckoutAdjustments
      initialCart={initialCart}
      gratuity={gratuity}
      {...(loyalty ? { loyalty } : {})}
      onUpdateGratuity={(cart, payload) =>
        mutate(cart, { kind: "gratuity", payload })
      }
      onApplyDiscount={(cart, code) =>
        mutate(cart, { kind: "apply-discount", code })
      }
      onRemoveDiscount={(cart) => mutate(cart, { kind: "remove-discount" })}
    />
  );
}
