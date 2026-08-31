"use client";

import type {
  CursorPage,
  PublicOrderDetail,
  PublicOrderSummary,
} from "@craveup/storefront-sdk";
import Link from "next/link";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money/format-money";
import { toStorefrontCustomerTransportError } from "@/lib/storefront/customer";
import { useStorefrontCustomer } from "@/lib/storefront/use-customer";

import { loadFixtureCustomerTransport } from "./customer-transport-loader";
import { getOrderHistoryMessages } from "./order-history.messages";
import styles from "./order-history.module.css";

const pageSize = 20;

export interface AccountOrdersCustomer {
  readonly orders: {
    readonly list: (params?: {
      limit?: number;
      cursor?: string;
    }) => Promise<CursorPage<PublicOrderSummary>>;
    readonly get: (orderId: string) => Promise<PublicOrderDetail>;
  };
}

export interface AccountOrdersProps {
  readonly merchantSlug: string;
  readonly locale: string;
  readonly timeZone: string;
  readonly mode: "fixture" | "live";
  readonly orderId?: string;
}

export interface AccountOrdersViewProps {
  readonly customer: AccountOrdersCustomer;
  readonly locale: string;
  readonly timeZone: string;
  readonly orderId?: string;
}

type OrdersState =
  | { readonly kind: "loading" }
  | { readonly kind: "signed-out" }
  | {
      readonly kind: "unavailable";
      readonly retryAfterSeconds: number;
    }
  | {
      readonly kind: "list";
      readonly orders: readonly PublicOrderSummary[];
      readonly nextCursor: string | null;
    }
  | { readonly kind: "detail"; readonly order: PublicOrderDetail };

function failureState(
  error: unknown,
): Extract<OrdersState, { kind: "signed-out" | "unavailable" }> {
  const safeError = toStorefrontCustomerTransportError(error);
  if (safeError.state === "authentication-required") {
    return { kind: "signed-out" };
  }
  return {
    kind: "unavailable",
    retryAfterSeconds:
      safeError.state === "rate-limited"
        ? Math.max(Math.ceil((safeError.retryAfterMs ?? 1_000) / 1_000), 1)
        : 0,
  };
}

function useSecondCountdown() {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (remaining <= 0) return;
    const timeout = window.setTimeout(
      () => setRemaining((seconds) => Math.max(seconds - 1, 0)),
      1_000,
    );
    return () => window.clearTimeout(timeout);
  }, [remaining]);
  return [remaining, setRemaining] as const;
}

function formatOrderDate(
  orderDate: string,
  locale: string,
  timeZone: string,
): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(orderDate);
  const date = new Date(
    dateOnly ? `${orderDate}T00:00:00.000Z` : orderDate,
  );
  if (Number.isNaN(date.getTime())) return orderDate;
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: dateOnly ? "UTC" : timeZone,
  }).format(date);
}

function statusTone(status: string): "success" | "danger" | "neutral" {
  const normalized = status.toUpperCase();
  if (normalized === "DELIVERED" || normalized === "COMPLETED") {
    return "success";
  }
  if (normalized === "CANCELLED" || normalized === "FAILED") {
    return "danger";
  }
  return "neutral";
}

function OrderStatus({ status }: { readonly status: string }) {
  return (
    <span className={styles.badge} data-tone={statusTone(status)}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function AccountOrders({
  merchantSlug,
  locale,
  timeZone,
  mode,
  orderId,
}: AccountOrdersProps) {
  return (
    <ScopedAccountOrders
      key={merchantSlug}
      merchantSlug={merchantSlug}
      locale={locale}
      timeZone={timeZone}
      mode={mode}
      orderId={orderId}
    />
  );
}

function ScopedAccountOrders({
  merchantSlug,
  locale,
  timeZone,
  mode,
  orderId,
}: AccountOrdersProps) {
  const customer = useStorefrontCustomer({
    merchantSlug,
    ...(mode === "fixture"
      ? { getTransport: loadFixtureCustomerTransport }
      : {}),
  });

  return (
    <AccountOrdersView
      key={orderId === undefined ? "target:list" : `target:detail:${orderId}`}
      customer={customer}
      locale={locale}
      timeZone={timeZone}
      orderId={orderId}
    />
  );
}

export function AccountOrdersView({
  customer,
  locale,
  timeZone,
  orderId,
}: AccountOrdersViewProps) {
  const messages = getOrderHistoryMessages(locale);
  const [state, setState] = useState<OrdersState>({ kind: "loading" });
  const [reloadSequence, setReloadSequence] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [paginationError, setPaginationError] = useState(false);
  const [retryRemaining, setRetryRemaining] = useSecondCountdown();
  const [paginationRetryRemaining, setPaginationRetryRemaining] =
    useSecondCountdown();
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterRetryRef = useRef(false);
  const { orders } = customer;

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        if (orderId) {
          const order = await orders.get(orderId);
          if (active) setState({ kind: "detail", order });
          return;
        }
        const result = await orders.list({ limit: pageSize });
        if (active) {
          setState({
            kind: "list",
            orders: result.items,
            nextCursor: result.nextCursor,
          });
        }
      } catch (error) {
        if (active) {
          const failure = failureState(error);
          setState(failure);
          setRetryRemaining(
            failure.kind === "unavailable"
              ? failure.retryAfterSeconds
              : 0,
          );
        }
      } finally {
        if (active) setRetrying(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [orderId, orders, reloadSequence, setRetryRemaining]);

  useEffect(() => {
    if (
      focusAfterRetryRef.current &&
      !retrying &&
      state.kind !== "loading"
    ) {
      focusAfterRetryRef.current = false;
      resultHeadingRef.current?.focus();
    }
  }, [retrying, state.kind]);

  async function loadMore() {
    if (
      state.kind !== "list" ||
      !state.nextCursor ||
      loadingMore ||
      paginationRetryRemaining > 0
    ) {
      return;
    }
    setLoadingMore(true);
    setPaginationError(false);
    setPaginationRetryRemaining(0);
    try {
      const result = await orders.list({
        cursor: state.nextCursor,
        limit: pageSize,
      });
      setState({
        kind: "list",
        orders: [...state.orders, ...result.items],
        nextCursor: result.nextCursor,
      });
    } catch (error) {
      const failure = failureState(error);
      if (failure.kind === "signed-out") {
        setState({ kind: "signed-out" });
      } else {
        setPaginationError(true);
        setPaginationRetryRemaining(failure.retryAfterSeconds);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function retryInitialLoad() {
    if (retrying || retryRemaining > 0) return;
    focusAfterRetryRef.current = true;
    setRetrying(true);
    setPaginationError(false);
    setReloadSequence((sequence) => sequence + 1);
  }

  if (state.kind === "loading") {
    return (
      <section className={styles.surface} aria-labelledby="orders-heading">
        <h1 className={styles.heading} id="orders-heading">
          {messages.heading}
        </h1>
        <p className={styles.statusMessage} role="status">
          {messages.loadingOrders}
        </p>
      </section>
    );
  }

  if (state.kind === "signed-out") {
    return (
      <OrderState
        headingRef={resultHeadingRef}
        heading={messages.signInHeading}
        description={messages.signInDescription}
        action={<ButtonLink href="/account/sign-in">{messages.signIn}</ButtonLink>}
      />
    );
  }

  if (state.kind === "unavailable") {
    const detail = Boolean(orderId);
    return (
      <OrderState
        headingRef={resultHeadingRef}
        heading={
          detail
            ? messages.orderUnavailableHeading
            : messages.ordersUnavailableHeading
        }
        description={
          detail
            ? messages.orderUnavailableDescription
            : messages.ordersUnavailableDescription
        }
        action={
          detail ? (
            <ButtonLink href="/account/orders">
              {messages.backToOrders}
            </ButtonLink>
          ) : (
            <button
              className={styles.retryButton}
              type="button"
              aria-busy={retrying || undefined}
              aria-disabled={retrying || retryRemaining > 0 || undefined}
              onClick={retryInitialLoad}
            >
              {retrying
                ? messages.loadingOrders
                : retryRemaining > 0
                  ? messages.tryAgainIn(retryRemaining)
                  : messages.tryAgain}
            </button>
          )
        }
      />
    );
  }

  if (state.kind === "detail") {
    return (
      <OrderDetail
        headingRef={resultHeadingRef}
        order={state.order}
        locale={locale}
        timeZone={timeZone}
      />
    );
  }

  if (state.orders.length === 0) {
    return (
      <OrderState
        headingRef={resultHeadingRef}
        heading={messages.emptyHeading}
        description={messages.emptyDescription}
        action={<ButtonLink href="/">{messages.browseMenu}</ButtonLink>}
      />
    );
  }

  return (
    <section className={styles.surface} aria-labelledby="orders-heading">
      <h1
        className={`${styles.heading} ${styles.focusTarget}`}
        id="orders-heading"
        ref={resultHeadingRef}
        tabIndex={-1}
      >
        {messages.heading}
      </h1>
      <ol className={styles.orderList}>
        {state.orders.map((order) => (
          <li className={styles.orderCard} key={order.id}>
            <div className={styles.orderCardInner}>
              <div className={styles.orderSummary}>
                <span className={styles.orderLabel}>
                  {formatOrderDate(order.orderDate, locale, timeZone)} ·{" "}
                  {messages.itemCount(order.totalQuantity)}
                </span>
                <span className={styles.orderTotal}>
                  {formatMoney(order.orderTotal, order.currency, locale)}
                </span>
              </div>
              <div className={styles.orderActions}>
                <OrderStatus status={order.status} />
                <Link
                  className={styles.secondaryLink}
                  href={`/account/orders/${encodeURIComponent(order.id)}`}
                >
                  {messages.viewOrder}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {state.nextCursor ? (
        <button
          className={styles.loadMore}
          type="button"
          disabled={loadingMore || paginationRetryRemaining > 0}
          onClick={() => void loadMore()}
        >
          {loadingMore
            ? messages.loadingMore
            : paginationRetryRemaining > 0
              ? messages.tryAgainIn(paginationRetryRemaining)
              : messages.loadMore}
        </button>
      ) : null}
      {paginationError ? (
        <p className={styles.paginationError} role="alert">
          {paginationRetryRemaining > 0
            ? messages.paginationRateLimited
            : messages.paginationError}
        </p>
      ) : null}
      <p className={styles.statusMessage} role="status" aria-live="polite">
        {loadingMore ? messages.loadingMore : ""}
      </p>
    </section>
  );
}

function OrderState({
  heading,
  headingRef,
  description,
  action,
}: {
  readonly heading: string;
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly description: string;
  readonly action: ReactNode;
}) {
  return (
    <section className={styles.surface}>
      <div className={styles.stateCard}>
        <h1
          className={`${styles.stateHeading} ${styles.focusTarget}`}
          ref={headingRef}
          tabIndex={-1}
        >
          {heading}
        </h1>
        <p className={styles.stateDescription}>{description}</p>
        {action}
      </div>
    </section>
  );
}

function MoneyRow({
  label,
  amount,
  currency,
  locale,
  emphasis = false,
}: {
  readonly label: string;
  readonly amount: string;
  readonly currency: string;
  readonly locale: string;
  readonly emphasis?: boolean;
}) {
  return (
    <div className={styles.moneyRow} data-emphasis={emphasis || undefined}>
      <dt>{label}</dt>
      <dd>{formatMoney(amount, currency, locale)}</dd>
    </div>
  );
}

function OrderDetail({
  headingRef,
  order,
  locale,
  timeZone,
}: {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly order: PublicOrderDetail;
  readonly locale: string;
  readonly timeZone: string;
}) {
  const messages = getOrderHistoryMessages(locale);
  const payment = order.payment;

  return (
    <article className={styles.surface}>
      <Link className={styles.backLink} href="/account/orders">
        {messages.backToOrders}
      </Link>
      <div>
        <h1
          className={`${styles.detailHeading} ${styles.focusTarget}`}
          ref={headingRef}
          tabIndex={-1}
        >
          {messages.orderHeading(order.shortId)}
        </h1>
        <p className={styles.detailMeta}>
          {formatOrderDate(order.orderDate, locale, timeZone)} ·{" "}
          {messages.itemCount(order.totalQuantity)} ·{" "}
          {formatMoney(order.orderTotal, order.currency, locale)}
        </p>
      </div>
      <OrderStatus status={order.status} />
      {order.partiallyRefunded ? (
        <p className={styles.partialRefund} role="status">
          {messages.partiallyRefunded}
        </p>
      ) : null}
      <div className={styles.detailSections}>
        <section className={styles.detailCard} aria-labelledby="order-items-heading">
          <h2 className={styles.sectionHeading} id="order-items-heading">
            {messages.itemsHeading}
          </h2>
          <ul className={styles.itemList}>
            {order.items.map((item) => (
              <li className={styles.item} key={item.id}>
                <div className={styles.itemHeading}>
                  <div>
                    <p className={styles.itemName}>{item.name}</p>
                    <p className={styles.orderMeta}>
                      {messages.quantity(item.quantity)}
                    </p>
                  </div>
                  <p className={styles.itemTotal}>
                    {formatMoney(item.total, order.currency, locale)}
                  </p>
                </div>
                {item.modifiers.length > 0 ? (
                  <ul className={styles.modifierList}>
                    {item.modifiers.map((modifier, index) => (
                      <li className={styles.modifier} key={`${modifier.groupName}-${modifier.name}-${index}`}>
                        {modifier.name} · {formatMoney(modifier.price, order.currency, locale)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.detailCard} aria-labelledby="order-summary-heading">
          <h2 className={styles.sectionHeading} id="order-summary-heading">
            {messages.orderSummaryHeading}
          </h2>
          <dl className={styles.moneyList}>
            <MoneyRow label={messages.subtotal} amount={order.pricing.subtotal} currency={order.currency} locale={locale} />
            <MoneyRow label={messages.discount} amount={order.pricing.discount} currency={order.currency} locale={locale} />
            <MoneyRow label={messages.tax} amount={order.pricing.tax} currency={order.currency} locale={locale} />
            <MoneyRow label={messages.tip} amount={order.pricing.tip} currency={order.currency} locale={locale} />
            <MoneyRow label={messages.serviceFee} amount={order.pricing.serviceFee} currency={order.currency} locale={locale} />
            <MoneyRow label={messages.fulfillmentFee} amount={order.pricing.fulfillmentFee} currency={order.currency} locale={locale} />
            <MoneyRow label={messages.enterpriseFee} amount={order.pricing.enterpriseFee} currency={order.currency} locale={locale} />
            <MoneyRow label={messages.total} amount={order.pricing.total} currency={order.currency} locale={locale} emphasis />
            <MoneyRow label={messages.refunded} amount={order.pricing.refunded} currency={order.currency} locale={locale} />
            <MoneyRow label={messages.netPaid} amount={order.pricing.netPaid} currency={order.currency} locale={locale} emphasis />
          </dl>
        </section>
        {order.deliveryInfo?.deliveryAddress ? (
          <section className={styles.detailCard} aria-labelledby="order-delivery-heading">
            <h2 className={styles.sectionHeading} id="order-delivery-heading">
              {messages.deliveryHeading}
            </h2>
            <p className={styles.deliveryAddress}>
              {order.deliveryInfo.deliveryAddress}
            </p>
          </section>
        ) : null}
        {payment ? (
          <section className={styles.detailCard} aria-labelledby="order-payment-heading">
            <h2 className={styles.sectionHeading} id="order-payment-heading">
              {messages.paymentHeading}
            </h2>
            <p className={styles.payment}>
              {payment.walletType
                ? messages.paymentWallet(payment.walletType)
                : payment.cardBrand && payment.cardLast4
                  ? messages.paymentCard(payment.cardBrand, payment.cardLast4)
                  : messages.paymentHeading}
            </p>
          </section>
        ) : null}
      </div>
    </article>
  );
}
