"use client";

import type {
  LoyaltyQuote,
  StorefrontCart,
  UpdateGratuityPayload,
} from "@craveup/storefront-sdk";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { OrderSummary } from "@/features/cart/order-summary";
import type {
  StorefrontLoyaltyMutationResult,
  StorefrontLoyaltyQuoteResult,
} from "@/features/loyalty/loyalty-actions";

import type { CheckoutGratuityState } from "./load-checkout-adjustment-config";
import styles from "./checkout-adjustments.module.css";

export interface CheckoutLoyaltyAdapter {
  quote(cart: StorefrontCart): Promise<StorefrontLoyaltyQuoteResult>;
  redeem(
    cart: StorefrontCart,
    rewardId: string,
  ): Promise<StorefrontLoyaltyMutationResult>;
  cancel(cart: StorefrontCart): Promise<StorefrontLoyaltyMutationResult>;
}

export interface CheckoutAdjustmentsProps {
  readonly initialCart: StorefrontCart;
  readonly gratuity: CheckoutGratuityState;
  readonly loyalty?: CheckoutLoyaltyAdapter;
  readonly onUpdateGratuity: (
    cart: StorefrontCart,
    payload: UpdateGratuityPayload,
  ) => Promise<StorefrontCart>;
  readonly onApplyDiscount: (
    cart: StorefrontCart,
    code: string,
  ) => Promise<StorefrontCart>;
  readonly onRemoveDiscount: (cart: StorefrontCart) => Promise<StorefrontCart>;
}

function adjustmentErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code === "CART_CONFLICT") {
    return "Your order changed. Review the refreshed cart, then retry the adjustment.";
  }
  if (code === "CART_EXPIRED" || code === "NOT_FOUND") {
    return "Your ordering session expired. Return to the menu to start again.";
  }
  if (code === "RATE_LIMITED") {
    return "Too many checkout changes. Wait a moment and try again.";
  }
  if (code === "IDEMPOTENCY_IN_PROGRESS") {
    return "The previous checkout change is still processing. Check its status before starting another.";
  }
  if (code === "VALIDATION_ERROR") {
    return "That checkout adjustment was not accepted. Review it and try again.";
  }
  return "The checkout adjustment could not be saved. Try again.";
}

function refreshedCart(error: unknown): StorefrontCart | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "cart" in error &&
    typeof error.cart === "object" &&
    error.cart !== null
  ) {
    return error.cart as StorefrontCart;
  }
  return undefined;
}

function hasMoney(value: string) {
  return !/^0(?:\.0+)?$/.test(value);
}

function gratuityConfig(state: CheckoutGratuityState) {
  return state.state === "available" && state.config.enabled
    ? state.config
    : null;
}

export function CheckoutAdjustments({
  initialCart,
  gratuity,
  loyalty,
  onUpdateGratuity,
  onApplyDiscount,
  onRemoveDiscount,
}: CheckoutAdjustmentsProps) {
  const [cart, setCart] = useState(initialCart);
  const [selectedTip, setSelectedTip] = useState<string>();
  const [customTip, setCustomTip] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [pending, setPending] = useState(false);
  const [retryRemaining, setRetryRemaining] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loyaltyQuote, setLoyaltyQuote] = useState<LoyaltyQuote>();
  const [loyaltyUnavailable, setLoyaltyUnavailable] = useState(false);
  const tipConfig = gratuityConfig(gratuity);
  const blocked = pending || retryRemaining > 0;

  useEffect(() => {
    if (retryRemaining <= 0) return;
    const timer = window.setInterval(
      () => setRetryRemaining((remaining) => Math.max(0, remaining - 1)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [retryRemaining]);

  useEffect(() => {
    if (!loyalty) return;
    let active = true;
    void loyalty.quote(cart).then(
      (result) => {
        if (!active) return;
        if (result.state === "enabled") {
          setLoyaltyQuote(result.quote);
          setLoyaltyUnavailable(false);
        } else if (result.state === "unavailable") {
          setLoyaltyUnavailable(true);
        }
      },
      () => active && setLoyaltyUnavailable(true),
    );
    return () => {
      active = false;
    };
  }, [cart, loyalty]);

  async function run(
    action: () => Promise<StorefrontCart>,
    success: (cart: StorefrontCart) => string,
  ) {
    setPending(true);
    setError("");
    try {
      const returned = await action();
      setCart(returned);
      setStatus(success(returned));
    } catch (caught) {
      const refreshed = refreshedCart(caught);
      if (refreshed) setCart(refreshed);
      const code =
        typeof caught === "object" && caught !== null && "code" in caught
          ? String(caught.code)
          : "";
      if (code === "RATE_LIMITED") {
        const retryAfterMs =
          typeof caught === "object" &&
          caught !== null &&
          "retryAfterMs" in caught &&
          typeof caught.retryAfterMs === "number" &&
          Number.isSafeInteger(caught.retryAfterMs) &&
          caught.retryAfterMs >= 0
            ? caught.retryAfterMs
            : 1_000;
        setRetryRemaining(Math.max(1, Math.ceil(retryAfterMs / 1_000)));
      }
      setError(adjustmentErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  function chooseTip(percentage: string) {
    void run(
      () => onUpdateGratuity(cart, { percentage }),
      (returned) => {
        setSelectedTip(percentage);
        return `Tip updated. The current cart shows ${returned.waiterTipTotalFormatted}.`;
      },
    );
  }

  function applyCustomTip(event: FormEvent) {
    event.preventDefault();
    const amount = customTip.trim();
    if (!amount) {
      setError("Enter a custom tip amount.");
      return;
    }
    void run(
      () => onUpdateGratuity(cart, { amount }),
      (returned) => {
        setSelectedTip("custom");
        return `Tip updated. The current cart shows ${returned.waiterTipTotalFormatted}.`;
      },
    );
  }

  function applyDiscount(event: FormEvent) {
    event.preventDefault();
    const code = discountCode.trim();
    if (!code) {
      setError("Enter a discount code.");
      return;
    }
    void run(
      () => onApplyDiscount(cart, code),
      (returned) => `Discount applied. The current cart shows ${returned.discountTotalFormatted}.`,
    );
  }

  async function runLoyalty(action: () => Promise<StorefrontLoyaltyMutationResult>) {
    setPending(true);
    setError("");
    try {
      const result = await action();
      if ("cart" in result && result.cart) setCart(result.cart);
      if (result.state === "applied") setStatus("Reward applied to the current cart.");
      else if (result.state === "cancelled") setStatus("Reward removed from the current cart.");
      else {
        setLoyaltyQuote(undefined);
        setLoyaltyUnavailable(true);
        setStatus("Rewards are unavailable, but you can continue checkout.");
      }
    } catch {
      setLoyaltyQuote(undefined);
      setLoyaltyUnavailable(true);
      setStatus("Rewards are unavailable, but you can continue checkout.");
    } finally {
      setPending(false);
    }
  }

  const rows = [
    { id: "subtotal", label: "Subtotal", formattedValue: cart.subTotalFormatted },
    ...(cart.discountCode
      ? [{
          id: "discount",
          label: `Discount · ${cart.discountCode}`,
          formattedValue: `−${cart.discountTotalFormatted}`,
          kind: "discount" as const,
        }]
      : []),
    ...(hasMoney(cart.waiterTipTotal)
      ? [{ id: "tip", label: "Tip", formattedValue: cart.waiterTipTotalFormatted }]
      : []),
    {
      id: "pickup",
      label: "Pickup",
      formattedValue: cart.fulfillmentMethodFeeTotalFormatted,
    },
    {
      id: "tax",
      label: "Taxes & fees",
      formattedValue: cart.taxAndFeeTotalFormatted,
    },
  ];

  return (
    <div className={styles.adjustments} aria-busy={pending}>
      {tipConfig ? (
        <section className={styles.section} aria-labelledby="checkout-tip-title">
          <h2 id="checkout-tip-title">Add a tip</h2>
          {tipConfig.description ? <p>{tipConfig.description}</p> : null}
          <div className={styles.tipOptions}>
            {tipConfig.tipPercentage.map((percentage) => (
              <button
                type="button"
                key={percentage}
                aria-pressed={selectedTip === percentage}
                disabled={blocked}
                onClick={() => chooseTip(percentage)}
              >
                {percentage}%
              </button>
            ))}
            {tipConfig.shouldAllowCustomTip ? (
              <button
                type="button"
                aria-pressed={selectedTip === "custom"}
                disabled={blocked}
                onClick={() => setSelectedTip("custom")}
              >
                Other
              </button>
            ) : null}
          </div>
          {selectedTip === "custom" ? (
            <form className={styles.inlineForm} onSubmit={applyCustomTip}>
              <label>
                Custom tip amount
                <input
                  inputMode="decimal"
                  value={customTip}
                  onChange={(event) => setCustomTip(event.target.value)}
                />
              </label>
              <button type="submit" disabled={blocked}>Apply tip</button>
            </form>
          ) : null}
        </section>
      ) : gratuity.state === "unavailable" ? (
        <p className={styles.notice}>Tips are temporarily unavailable.</p>
      ) : null}

      <section className={styles.section} aria-labelledby="checkout-discount-title">
        <h2 id="checkout-discount-title">Discount</h2>
        {cart.discountCode ? (
          <div className={styles.appliedDiscount}>
            <span><strong>{cart.discountCode}</strong> applied</span>
            <button
              type="button"
              disabled={blocked}
              onClick={() =>
                void run(
                  () => onRemoveDiscount(cart),
                  () => "Discount removed from the current cart.",
                )
              }
            >
              Remove
            </button>
          </div>
        ) : (
          <form className={styles.inlineForm} onSubmit={applyDiscount}>
            <label>
              Discount code
              <input
                autoCapitalize="characters"
                value={discountCode}
                onChange={(event) => setDiscountCode(event.target.value)}
              />
            </label>
            <button type="submit" disabled={blocked}>Apply</button>
          </form>
        )}
      </section>

      {loyalty && loyaltyQuote ? (
        <section className={styles.section} aria-labelledby="checkout-rewards-title">
          <h2 id="checkout-rewards-title">Rewards</h2>
          {loyaltyQuote.rewards?.map((reward) => (
            <div className={styles.reward} key={reward.id}>
              <span><strong>{reward.name}</strong><small>{reward.pointsCost} points</small></span>
              {loyaltyQuote.appliedRewardId === reward.id ? (
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => void runLoyalty(() => loyalty.cancel(cart))}
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  disabled={blocked || !reward.redeemable}
                  onClick={() => void runLoyalty(() => loyalty.redeem(cart, reward.id))}
                >
                  Apply
                </button>
              )}
            </div>
          ))}
        </section>
      ) : loyaltyUnavailable && !status ? (
        <p className={styles.notice}>Rewards are unavailable, but you can continue checkout.</p>
      ) : null}

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <p className={styles.status} role="status" aria-live="polite">
        {retryRemaining > 0
          ? `Checkout changes are available in ${retryRemaining} seconds.`
          : status}
      </p>
      <OrderSummary
        heading="Order summary"
        showHeading
        rows={rows}
        totalLabel="Total"
        formattedTotal={cart.orderTotalWithServiceFeeFormatted}
      />
      <p className={styles.secureNote} id="secure-checkout-note">
        Payment is completed on Crave’s secure hosted checkout.
      </p>
      <Button aria-describedby="secure-checkout-note" disabled>
        Continue to secure checkout
      </Button>
    </div>
  );
}
