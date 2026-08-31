"use client";

import type { StorefrontCart } from "@craveup/storefront-sdk";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { toStorefrontErrorState } from "@/lib/storefront/error-state";

import { ConnectedCheckoutAdjustments } from "./connected-checkout-adjustments";
import type { CheckoutAdjustmentRuntime } from "./checkout-adjustment-runtime";
import type { CheckoutIdentityResult } from "./checkout-identity";
import type { CheckoutGratuityState } from "./load-checkout-adjustment-config";
import { loadPickupPreflight } from "./checkout-preflight-runtime";
import type { PickupPreflightResult } from "./pickup-preflight";
import {
  CheckoutScheduling,
  type CheckoutOrderTimes,
} from "./scheduling/checkout-scheduling";
import { getCheckoutSchedulingMessages } from "./scheduling/checkout-scheduling.messages";
import type { OrderTimeRuntime } from "@/features/fulfillment/time/order-time-runtime";
import styles from "./pickup-checkout-preflight.module.css";

const blockedCopy = {
  "missing-cart": "Your order session is no longer available. Return to the menu to start again.",
  empty: "Your order is empty. Add an item before checkout.",
  expired: "Your order has expired. Return to the menu to start a new order.",
  immutable: "This order can no longer be changed or checked out.",
  completed: "This order has already been completed.",
  stale: "Your order changed. Review the refreshed cart before continuing.",
  "authentication-required": "Your verified session expired. Verify your number again to continue.",
  "incomplete-fulfillment": "Complete your pickup details before checkout.",
} as const;

function cartHasSelectableOrderTime(
  cart: StorefrontCart,
  orderTimes: CheckoutOrderTimes,
): boolean {
  if (cart.pickupType === "ASAP") {
    return orderTimes.state === "ready" && orderTimes.allowAsap;
  }
  if (!orderTimes.scheduleAllowed) return false;
  return orderTimes.days.some((day) =>
    day.slots.some(
      (slot) =>
        slot.available !== false &&
        slot.orderDate === cart.orderDate &&
        slot.orderTime === cart.orderTime,
    ),
  );
}

function pickupTimeSummary(
  cart: StorefrontCart,
  orderTimes: CheckoutOrderTimes,
  asapLabel: string,
): string {
  if (cart.pickupType === "ASAP") return asapLabel;
  const dayLabel = orderTimes.days.find(
    (day) => day.date === cart.orderDate,
  )?.label ?? cart.orderDate;
  const timeLabel = orderTimes.days
    .flatMap((day) => day.slots)
    .find(
      (slot) =>
        slot.orderDate === cart.orderDate && slot.orderTime === cart.orderTime,
    )?.label ?? cart.orderTime;
  return `${dayLabel} · ${timeLabel}`;
}

export function PickupCheckoutPreflight({
  adjustmentRuntime,
  backHref,
  gratuity,
  identity,
  locationAddress,
  locationId,
  locale,
  merchantSlug,
  mode,
  orderTimes,
  orderTimeRuntime,
}: {
  readonly adjustmentRuntime: CheckoutAdjustmentRuntime;
  readonly backHref: string;
  readonly gratuity: CheckoutGratuityState;
  readonly identity: CheckoutIdentityResult;
  readonly locationAddress?: string;
  readonly locationId: string;
  readonly locale: string;
  readonly merchantSlug: string;
  readonly mode: "fixture" | "live";
  readonly orderTimes: CheckoutOrderTimes;
  readonly orderTimeRuntime: OrderTimeRuntime;
}) {
  const router = useRouter();
  const schedulingMessages = getCheckoutSchedulingMessages(locale);
  const [result, setResult] = useState<PickupPreflightResult | null>(null);
  const [authoritativeCart, setAuthoritativeCart] = useState<StorefrontCart | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [retryRemaining, setRetryRemaining] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const restorePickupTimeFocusRef = useRef(false);
  const readyTimeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void loadPickupPreflight({
      merchantSlug,
      locationId,
      mode,
      identity,
    }).then(
      (next) => {
        if (!active) return;
        setResult(next);
        if (next.state === "ready") {
          setAuthoritativeCart(next.cart);
          setScheduling(!cartHasSelectableOrderTime(next.cart, orderTimes));
        }
      },
      (error) => {
        if (!active) return;
        const safe = toStorefrontErrorState(error);
        setFailed(
          safe.state === "rate-limited"
            ? "Checkout validation is temporarily rate limited."
            : safe.state === "operation-pending"
              ? "Checkout validation is still finishing."
              : "Checkout details could not be validated.",
        );
        setRetryRemaining(
          Math.max(0, Math.ceil((safe.retryAfterMs ?? 0) / 1_000)),
        );
      },
    );
    return () => {
      active = false;
    };
  }, [identity, locationId, merchantSlug, mode, orderTimes, retryVersion]);

  useEffect(() => {
    if (scheduling || !restorePickupTimeFocusRef.current) return;
    restorePickupTimeFocusRef.current = false;
    readyTimeRef.current?.focus();
  }, [scheduling]);

  useEffect(() => {
    if (retryRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setRetryRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [retryRemaining]);

  if (failed) {
    return (
      <section className={styles.blocked} aria-labelledby="pickup-checkout-error">
        <h1 id="pickup-checkout-error">Pickup checkout</h1>
        <p role="alert">{failed}</p>
        <Button
          disabled={retryRemaining > 0}
          onClick={() => {
            setFailed(null);
            setResult(null);
            setRetryVersion((version) => version + 1);
          }}
        >
          {retryRemaining > 0 ? `Try again in ${retryRemaining}s` : "Try again"}
        </Button>
      </section>
    );
  }
  if (!result) {
    return <p className={styles.loading} role="status">Validating your order…</p>;
  }
  if (result.state === "blocked") {
    return (
      <section className={styles.blocked} aria-labelledby="pickup-checkout-blocked">
        <h1 id="pickup-checkout-blocked">Pickup checkout</h1>
        <p role="alert">{blockedCopy[result.reason]}</p>
        <Link href={backHref}>Review your cart</Link>
      </section>
    );
  }

  const cart = authoritativeCart ?? result.cart;
  const canCancelScheduling = cartHasSelectableOrderTime(cart, orderTimes);
  if (scheduling) {
    return (
      <CheckoutScheduling
        key={JSON.stringify(orderTimes)}
        cart={cart}
        canCancel={canCancelScheduling}
        locationId={locationId}
        locale={locale}
        orderTimes={orderTimes}
        runtime={orderTimeRuntime}
        onCancel={() => {
          if (!canCancelScheduling) return;
          restorePickupTimeFocusRef.current = true;
          setScheduling(false);
        }}
        onCartRefreshed={setAuthoritativeCart}
        onReload={() => router.refresh()}
        onScheduled={(updatedCart) => {
          setAuthoritativeCart(updatedCart);
          restorePickupTimeFocusRef.current = true;
          setScheduling(false);
        }}
      />
    );
  }
  const customerName =
    identity.orderName ??
    [identity.profile.customerName, identity.profile.lastName]
      .filter(Boolean)
      .join(" ");
  const contact =
    identity.profile.phoneNumber ?? identity.profile.customerEmail ?? "Verified customer";
  const timingSummary = pickupTimeSummary(
    cart,
    orderTimes,
    schedulingMessages.asap,
  );
  return (
    <section
      className={styles.surface}
      data-checkout-state={cart.pickupType === "LATER" ? "scheduled" : "asap"}
      aria-labelledby="pickup-checkout-title"
    >
      <div className={styles.details}>
        <h1 id="pickup-checkout-title">Pickup checkout</h1>
        <section className={styles.card} aria-labelledby="pickup-location-title">
          <div className={styles.cardHeading}>
            <h2 id="pickup-location-title">Picking up from</h2>
            <Link href={`/${encodeURIComponent(locationId)}/fulfillment`}>Change</Link>
          </div>
          <p>{cart.restaurantDisplayName}{locationAddress ? ` · ${locationAddress}` : ""}</p>
          <button
            className={styles.readyTime}
            type="button"
            ref={readyTimeRef}
            aria-label={schedulingMessages.changePickupTime(timingSummary)}
            onClick={() => setScheduling(true)}
          >
            {timingSummary}
          </button>
        </section>
        <section className={styles.card} aria-labelledby="pickup-customer-title">
          <h2 id="pickup-customer-title">Your details</h2>
          <dl className={styles.customer}>
            <div><dt>Name for the order</dt><dd>{customerName}</dd></div>
            <div><dt>Contact</dt><dd>{contact}</dd></div>
          </dl>
        </section>
      </div>
      <aside className={styles.summary} aria-label="Order summary">
        <ul className={styles.items}>
          {cart.items.map((item) => (
            <li key={item.id}>
              <span><strong>{item.name}</strong><small>×{item.quantity}</small></span>
              <strong>{item.totalFormatted}</strong>
            </li>
          ))}
        </ul>
        <ConnectedCheckoutAdjustments
          key={cart.revision}
          gratuity={gratuity}
          initialCart={cart}
          runtime={adjustmentRuntime}
        />
      </aside>
    </section>
  );
}
