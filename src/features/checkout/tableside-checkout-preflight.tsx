"use client";

import type { StorefrontCart } from "@craveup/storefront-sdk";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { OrderSummary } from "@/features/cart/order-summary";
import { toStorefrontErrorState } from "@/lib/storefront/error-state";

import type { CheckoutIdentityResult } from "./checkout-identity";
import { loadTablesidePreflight } from "./checkout-preflight-runtime";
import type { StorefrontHostedCheckoutConfig } from "./hosted-checkout-integration";
import type { NavigateTopLevel } from "./hosted-checkout";
import {
  SecureCheckoutAction,
  type CheckoutHandoffRuntime,
} from "./secure-checkout-action";
import { getTablesideCheckoutMessages } from "./tableside-checkout.messages";
import type { TablesidePreflightResult } from "./tableside-preflight";
import styles from "./tableside-checkout-preflight.module.css";

function hasDisplayValue(value: string): boolean {
  return !/^0(?:\.0+)?$/.test(value);
}

export function TablesideCheckoutPreflight({
  backHref,
  checkoutConfig,
  handoffRuntime,
  identity,
  locale,
  locationId,
  merchantSlug,
  mode,
  navigateTopLevel,
  tableIdentifier,
}: {
  readonly backHref: string;
  readonly checkoutConfig: StorefrontHostedCheckoutConfig;
  readonly handoffRuntime: CheckoutHandoffRuntime;
  readonly identity: CheckoutIdentityResult;
  readonly locale: string;
  readonly locationId: string;
  readonly merchantSlug: string;
  readonly mode: "fixture" | "live";
  readonly navigateTopLevel?: NavigateTopLevel;
  readonly tableIdentifier: string;
}) {
  const messages = getTablesideCheckoutMessages(locale);
  const [result, setResult] = useState<TablesidePreflightResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [retryRemaining, setRetryRemaining] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const failureRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    void loadTablesidePreflight({
      merchantSlug,
      locationId,
      mode,
      identity,
      expectedTableIdentifier: tableIdentifier,
    }).then(
      (next) => {
        if (!active) return;
        setResult(next);
      },
      (error) => {
        if (!active) return;
        const safe = toStorefrontErrorState(error);
        setFailed(
          safe.state === "rate-limited"
            ? messages.rateLimited
            : safe.state === "operation-pending"
              ? messages.pending
              : messages.validationFailed,
        );
        setRetryRemaining(
          Math.max(0, Math.ceil((safe.retryAfterMs ?? 0) / 1_000)),
        );
      },
    );
    return () => {
      active = false;
    };
  }, [
    identity,
    locationId,
    merchantSlug,
    messages,
    mode,
    retryVersion,
    tableIdentifier,
  ]);

  useEffect(() => {
    if (failed) failureRef.current?.focus();
  }, [failed]);

  useEffect(() => {
    if (retryRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setRetryRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [retryRemaining]);

  if (failed) {
    return (
      <section className={styles.blocked} aria-labelledby="tableside-checkout-error">
        <h1 id="tableside-checkout-error">{messages.title}</h1>
        <p ref={failureRef} role="alert" tabIndex={-1}>{failed}</p>
        <Button
          disabled={retryRemaining > 0}
          onClick={() => {
            setFailed(null);
            setResult(null);
            setRetryVersion((version) => version + 1);
          }}
        >
          {retryRemaining > 0
            ? messages.retryAfter(retryRemaining)
            : messages.retry}
        </Button>
      </section>
    );
  }
  if (!result) {
    return <p className={styles.loading} role="status">{messages.loading}</p>;
  }
  if (result.state === "blocked") {
    return (
      <section className={styles.blocked} aria-labelledby="tableside-checkout-blocked">
        <h1 id="tableside-checkout-blocked">{messages.title}</h1>
        <p role="alert">{messages.block(result.reason)}</p>
        <Link href={backHref}>{messages.reviewCart}</Link>
      </section>
    );
  }

  return (
    <TablesideCheckoutReady
      cart={result.cart}
      checkoutConfig={checkoutConfig}
      handoffRuntime={handoffRuntime}
      locale={locale}
      locationId={locationId}
      {...(navigateTopLevel ? { navigateTopLevel } : {})}
    />
  );
}

function TablesideCheckoutReady({
  cart,
  checkoutConfig,
  handoffRuntime,
  locale,
  locationId,
  navigateTopLevel,
}: {
  readonly cart: StorefrontCart;
  readonly checkoutConfig: StorefrontHostedCheckoutConfig;
  readonly handoffRuntime: CheckoutHandoffRuntime;
  readonly locale: string;
  readonly locationId: string;
  readonly navigateTopLevel?: NavigateTopLevel;
}) {
  const messages = getTablesideCheckoutMessages(locale);
  const tableIdentifier = cart.tableServiceInfo?.tableNumber?.trim() ?? "";
  const changeHref = `/${encodeURIComponent(locationId)}/fulfillment/table?table=${encodeURIComponent(tableIdentifier)}`;
  const rows = [
    {
      id: "subtotal",
      label: messages.subtotal,
      formattedValue: cart.subTotalFormatted,
    },
    ...(cart.discountCode
      ? [{
          id: "discount",
          label: messages.discount(cart.discountCode),
          formattedValue: `\u2212${cart.discountTotalFormatted}`,
          kind: "discount" as const,
        }]
      : []),
    ...(hasDisplayValue(cart.waiterTipTotal)
      ? [{
          id: "tip",
          label: messages.tip,
          formattedValue: cart.waiterTipTotalFormatted,
        }]
      : []),
    {
      id: "taxes-and-fees",
      label: messages.taxesAndFees,
      formattedValue: cart.taxAndFeeTotalFormatted,
    },
  ];

  return (
    <section className={styles.surface} aria-labelledby="tableside-checkout-title">
      <header className={styles.heading}>
        <p className={styles.preview}>{messages.previewLabel}</p>
        <h1 id="tableside-checkout-title">{messages.title}</h1>
        <p>{messages.previewNote}</p>
      </header>

      <section className={styles.tableCard} aria-labelledby="tableside-table-title">
        <div>
          <h2 id="tableside-table-title">{messages.orderingAt}</h2>
          <p>{messages.tableLabel(tableIdentifier)}</p>
        </div>
        <Link href={changeHref}>{messages.change}</Link>
      </section>

      <section className={styles.cartSummary} aria-labelledby="tableside-cart-summary-title">
        <h2 id="tableside-cart-summary-title">{messages.cartSummary}</h2>
        <ul className={styles.items}>
          {cart.items.map((item) => (
            <li key={item.id}>
              <span>
                <strong>{item.quantity}{"\u00d7"} {item.name}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
              <strong>{item.totalFormatted}</strong>
            </li>
          ))}
        </ul>
      </section>

      <OrderSummary
        heading={messages.orderSummary}
        rows={rows}
        totalLabel={messages.total}
        formattedTotal={cart.orderTotalWithServiceFeeFormatted}
      />

      <div className={styles.action}>
        <SecureCheckoutAction
          cart={cart}
          config={checkoutConfig}
          label={messages.startOwnTab}
          locale={locale}
          runtime={handoffRuntime}
          {...(navigateTopLevel ? { navigateTopLevel } : {})}
        />
      </div>
    </section>
  );
}
