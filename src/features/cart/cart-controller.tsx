"use client";

import type { StorefrontCart } from "@craveup/storefront-sdk";

import { Button } from "@/components/ui/button";
import { getCartMessages } from "@/content/cart";
import type { FulfillmentDescription } from "@/features/fulfillment/types";

import { CartPage } from "./cart-page";
import type { CartActionRuntime } from "./cart-runtime";
import { createCartPageView, type CartViewLocation } from "./cart-view";
import { useCartActions } from "./use-cart-actions";
import styles from "./cart-page.module.css";

export interface CartControllerProps {
  readonly initialCart: StorefrontCart;
  readonly runtime: CartActionRuntime;
  readonly locale: string;
  readonly location: CartViewLocation;
  readonly browseHref: string;
  readonly tablesideDescription?: FulfillmentDescription;
}

function ScopedCartController({
  initialCart,
  runtime,
  locale,
  location,
  browseHref,
  tablesideDescription,
}: CartControllerProps) {
  const actions = useCartActions(runtime, initialCart);
  const cart = createCartPageView(
    location,
    getCartMessages(locale),
    actions.state.cart,
    tablesideDescription,
  );
  const tableIdentifier = actions.state.cart.tableServiceInfo?.tableNumber;
  const checkoutHref = tableIdentifier
    ? `${browseHref}/checkout?table=${encodeURIComponent(tableIdentifier)}`
    : `${browseHref}/checkout`;

  return (
    <>
      <CartPage
        cart={cart}
        browseHref={browseHref}
        checkoutHref={checkoutHref}
        pending={actions.state.pending}
        pendingItemId={actions.state.pendingItemId}
        onClear={actions.clear}
        onQuantityChange={actions.updateItemQuantity}
        onRemove={actions.removeItem}
      />
      {actions.state.announceCart ? (
        <p className="sr-only" role="status" aria-live="polite">
          {cart.headerCartLabel}
        </p>
      ) : null}
      {actions.state.message ? (
        <div className={styles.mutationNotice} role="alert">
          <p>{actions.state.message}</p>
          {actions.state.recovery ? (
            <Button onClick={() => void actions.retry()}>
              Retry cart update
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function controllerScope({
  initialCart,
  runtime,
}: Pick<CartControllerProps, "initialCart" | "runtime">): string {
  const merchantSlug =
    runtime.mode === "fixture"
      ? runtime.runtime.config.merchantSlug
      : runtime.merchantSlug;
  const profile =
    runtime.mode === "fixture" ? runtime.runtime.config.profile : "live";
  return JSON.stringify([
    runtime.mode,
    profile,
    merchantSlug,
    initialCart.merchantId,
    initialCart.locationId,
    initialCart.id,
    initialCart.revision,
  ]);
}

export function CartController(props: CartControllerProps) {
  return <ScopedCartController key={controllerScope(props)} {...props} />;
}
