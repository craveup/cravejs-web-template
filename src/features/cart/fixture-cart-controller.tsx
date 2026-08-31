"use client";

import type { StorefrontCart } from "@craveup/storefront-sdk";
import { useEffect, useState } from "react";

import {
  readFixtureCartSnapshot,
  writeFixtureCartSnapshot,
} from "@/fixtures/cart-snapshot";
import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import { createMerchantCartSessionStore } from "@/lib/storefront/session-store";

import { CartController, type CartControllerProps } from "./cart-controller";

export type FixtureCartControllerProps = Omit<
  CartControllerProps,
  "runtime"
> & {
  readonly runtime: FixtureRuntime;
};

export function FixtureCartController({
  initialCart,
  runtime,
  ...props
}: FixtureCartControllerProps) {
  const merchantSlug = runtime.config.merchantSlug;
  const [cart, setCart] = useState<StorefrontCart>();

  useEffect(() => {
    let active = true;
    const snapshot = readFixtureCartSnapshot(
      merchantSlug,
      initialCart.locationId,
    );
    const nextCart = snapshot ?? initialCart;
    if (!snapshot) writeFixtureCartSnapshot(merchantSlug, nextCart);
    createMerchantCartSessionStore(merchantSlug).set({
      merchantSlug,
      locationId: nextCart.locationId,
      cartId: nextCart.id,
      revision: nextCart.revision,
    });
    queueMicrotask(() => {
      if (active) setCart(nextCart);
    });
    return () => {
      active = false;
    };
  }, [initialCart, merchantSlug]);

  if (!cart) {
    return (
      <p className="sr-only" role="status">
        Loading your order.
      </p>
    );
  }

  return (
    <CartController
      {...props}
      initialCart={cart}
      runtime={{ mode: "fixture", runtime }}
    />
  );
}
