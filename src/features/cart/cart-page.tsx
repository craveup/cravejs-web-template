"use client";

import type { LinkProps } from "next/link";
import type { CSSProperties } from "react";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontSkipLink } from "@/components/shell/storefront-skip-link";
import { Button, ButtonLink } from "@/components/ui/button";
import type { EmptyCartCopy } from "@/content/cart";
import { CartEmpty } from "./cart-empty";
import { CartLine, type CartLineView } from "./cart-line";
import {
  OrderSummary,
  type CartSummaryRowView,
} from "./order-summary";
import styles from "./cart-page.module.css";

export interface CartRewardsView {
  label: string;
  earnedLabel: string;
  progressValue: number;
  progressLabel: string;
}

export interface TablesideCartContextView {
  sourceLabel: string;
  locationLabel: string;
  tableLabel: string;
  changeLabel: string;
  changeHref: LinkProps["href"];
  contextRegionLabel: string;
  previewLabel: string;
  bannerLabel: string;
  itemsHeading: string;
}

export interface CartPageView {
  locationLabel: string;
  headerCartLabel: string;
  heading: string;
  fulfillmentLabel: string;
  emptyState: EmptyCartCopy;
  items: readonly CartLineView[];
  summaryRows: readonly CartSummaryRowView[];
  formattedTotal: string;
  checkoutLabel: string;
  clearLabel: string;
  itemsRegionLabel: string;
  summaryRegionLabel: string;
  orderSummaryLabel: string;
  totalLabel: string;
  checkoutUnavailableTitle: string;
  rewards?: CartRewardsView;
  disclaimer?: string;
  tableside?: TablesideCartContextView;
}

export interface CartPageProps {
  cart: CartPageView;
  browseHref: string;
  checkoutHref?: LinkProps["href"];
  pendingItemId?: string;
  pending?: boolean;
  onClear?: () => void | Promise<void>;
  onQuantityChange?: (itemId: string, quantity: number) => void | Promise<void>;
  onRemove?: (itemId: string) => void | Promise<void>;
}

function CartStorefrontHeader({
  browseHref,
  cart,
}: Pick<CartPageProps, "browseHref" | "cart">) {
  return (
    <StorefrontHeader
      brand={cart.locationLabel}
      brandHref={browseHref}
      cartLabel={cart.headerCartLabel}
      items={[
        { id: "menu", label: "Menu", href: browseHref },
        { id: "locations", label: "Locations", href: "/stores" },
      ]}
    />
  );
}

function RewardsPanel({ rewards }: { rewards: CartRewardsView }) {
  const boundedProgress = Math.min(100, Math.max(0, rewards.progressValue));
  const progressStyle = {
    "--cart-rewards-progress": `${boundedProgress}%`,
  } as CSSProperties;

  return (
    <section className={styles.rewards} aria-labelledby="cart-rewards-title">
      <div className={styles.rewardsHeading}>
        <h2 id="cart-rewards-title">{rewards.label}</h2>
        <strong>{rewards.earnedLabel}</strong>
      </div>
      <div
        aria-label={rewards.progressLabel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={boundedProgress}
        className={styles.rewardsProgress}
        role="progressbar"
      >
        <span style={progressStyle} />
      </div>
      <p>{rewards.progressLabel}</p>
    </section>
  );
}

function CheckoutAction({
  href,
  label,
  unavailableTitle,
}: {
  href?: LinkProps["href"];
  label: string;
  unavailableTitle: string;
}) {
  const content = href ? (
    <ButtonLink href={href}>
      {label}
    </ButtonLink>
  ) : (
    <Button
      disabled
      title={unavailableTitle}
    >
      {label}
    </Button>
  );

  return <div className={styles.checkoutAction}>{content}</div>;
}

function TablesideContext({ context }: { context: TablesideCartContextView }) {
  return (
    <section
      aria-label={context.contextRegionLabel}
      className={styles.tablesideHeader}
    >
      <div className={styles.tablesideHeaderInner}>
        <p className={styles.tablesideSource}>{context.sourceLabel}</p>
        <p className={styles.tablesideLocation}>{context.locationLabel}</p>
        <div className={styles.tablesideSwitch}>
          <div>
            <strong>{context.tableLabel}</strong>
            <span>{context.previewLabel}</span>
          </div>
          <ButtonLink className={styles.changeAction} href={context.changeHref}>
            {context.changeLabel}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function CartPage({
  cart,
  browseHref,
  checkoutHref,
  pendingItemId,
  pending = false,
  onClear,
  onQuantityChange,
  onRemove,
}: CartPageProps) {
  if (!cart.items.length) {
    return (
      <>
        <StorefrontSkipLink />
        <CartStorefrontHeader browseHref={browseHref} cart={cart} />
        <CartEmpty browseHref={browseHref} copy={cart.emptyState} />
      </>
    );
  }

  const tableside = cart.tableside;

  return (
    <>
      <StorefrontSkipLink />
      <CartStorefrontHeader browseHref={browseHref} cart={cart} />
      <main
        className={styles.page}
        data-variant={tableside ? "tableside" : "default"}
        id="storefront-main"
        tabIndex={-1}
      >
        {tableside ? <TablesideContext context={tableside} /> : null}

        <div className={styles.body}>
          <div className={styles.content}>
            <div className={styles.primaryColumn}>
              {tableside ? (
                <>
                  <p className={styles.tablesideBanner}>{tableside.bannerLabel}</p>
                  <h1 className={`sr-only ${styles.tablesideItemsHeading}`}>
                    {tableside.itemsHeading}
                  </h1>
                </>
              ) : (
                <div className={styles.cartIntro}>
                  <div>
                    <h1>{cart.heading}</h1>
                    <p>{cart.fulfillmentLabel}</p>
                  </div>
                  <button
                    className={styles.clearButton}
                    type="button"
                    disabled={pending || !onClear}
                    onClick={() => {
                      if (onClear) void onClear();
                    }}
                  >
                    {cart.clearLabel}
                  </button>
                </div>
              )}
            <section aria-label={cart.itemsRegionLabel} className={styles.lines}>
              {cart.items.map((item, index) => (
                <CartLine
                  eager={index === 0}
                  item={item}
                  key={item.id}
                  pending={pending || pendingItemId === item.id}
                  variant={tableside ? "tableside" : "default"}
                  onQuantityChange={onQuantityChange}
                  onRemove={onRemove}
                />
              ))}
            </section>
            {cart.rewards ? <RewardsPanel rewards={cart.rewards} /> : null}
            </div>

            <aside className={styles.summaryColumn} aria-label={cart.summaryRegionLabel}>
              <OrderSummary
                rows={cart.summaryRows}
                formattedTotal={cart.formattedTotal}
                heading={cart.orderSummaryLabel}
                showHeading={!tableside}
                totalLabel={cart.totalLabel}
              />
              {cart.disclaimer ? <p className={styles.disclaimer}>{cart.disclaimer}</p> : null}
              <CheckoutAction
                href={checkoutHref}
                label={cart.checkoutLabel}
                unavailableTitle={cart.checkoutUnavailableTitle}
              />
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
