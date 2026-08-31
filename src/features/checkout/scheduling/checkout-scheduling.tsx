"use client";

import type { StorefrontCart, UpdateOrderTimePayload } from "@craveup/storefront-sdk";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { LoadedOrderTimes } from "@/features/fulfillment/time/load-order-times";
import type { OrderTimeState } from "@/features/fulfillment/time/order-time-picker";
import {
  updateOrderTime,
  type OrderTimeRuntime,
} from "@/features/fulfillment/time/order-time-runtime";

import { getCheckoutSchedulingMessages } from "./checkout-scheduling.messages";
import styles from "./checkout-scheduling.module.css";

export type CheckoutOrderTimes =
  | LoadedOrderTimes
  | Readonly<
      Omit<LoadedOrderTimes, "readinessReason" | "state"> & {
        readonly state: "error" | "rate-limited" | "unavailable";
        readonly retryAfterSeconds?: number;
      }
    >;

export interface CheckoutSchedulingProps {
  readonly cart: StorefrontCart;
  readonly locationId: string;
  readonly locale: string;
  readonly orderTimes: CheckoutOrderTimes;
  readonly runtime: OrderTimeRuntime;
  readonly canCancel?: boolean;
  readonly onCancel: () => void;
  readonly onCartRefreshed: (cart: StorefrontCart) => void;
  readonly onReload?: () => void;
  readonly onScheduled: (cart: StorefrontCart) => void;
}

function isLoadFailure(
  state: CheckoutOrderTimes["state"],
): state is "error" | "rate-limited" | "unavailable" {
  return state === "error" || state === "rate-limited" || state === "unavailable";
}

function selectedInstant(
  cart: StorefrontCart,
  orderTimes: CheckoutOrderTimes,
): string | undefined {
  if (
    cart.pickupType === "ASAP" &&
    orderTimes.allowAsap &&
    orderTimes.state === "ready"
  ) {
    return "asap";
  }
  if (cart.pickupType !== "LATER" || !orderTimes.scheduleAllowed) return undefined;
  return orderTimes.days
    .flatMap((day) => day.slots)
    .find(
      (slot) =>
        slot.available !== false &&
        slot.orderDate === cart.orderDate && slot.orderTime === cart.orderTime,
    )?.instant;
}

function initialDate(
  orderTimes: CheckoutOrderTimes,
  instant: string | undefined,
): string {
  const selectedDay = orderTimes.days.find((day) =>
    day.slots.some((slot) => slot.instant === instant),
  );
  return selectedDay?.date ?? orderTimes.days[0]?.date ?? "";
}

function payloadFor(
  orderTimes: CheckoutOrderTimes,
  instant: string,
): UpdateOrderTimePayload | null {
  if (instant === "asap") {
    return orderTimes.state === "ready" && orderTimes.allowAsap
      ? { pickupType: "ASAP" }
      : null;
  }
  if (!orderTimes.scheduleAllowed) return null;
  const slot = orderTimes.days
    .flatMap((day) => day.slots)
    .find(
      (candidate) =>
        candidate.available !== false && candidate.instant === instant,
    );
  return slot
    ? {
        pickupType: "LATER",
        orderDate: slot.orderDate,
        orderTime: slot.orderTime,
      }
    : null;
}

function selectionLabel(
  orderTimes: CheckoutOrderTimes,
  instant: string | undefined,
): string | null {
  if (instant === "asap") return "ASAP";
  if (!instant) return null;
  return orderTimes.days
    .flatMap((day) => day.slots)
    .find((slot) => slot.instant === instant)?.label ?? null;
}

function dayDateLabel(date: string, locale: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const value = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(value.valueOf()) || value.toISOString().slice(0, 10) !== date) {
    return date;
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function CheckoutScheduling(props: CheckoutSchedulingProps) {
  const messages = getCheckoutSchedulingMessages(props.locale);
  const canCancel = props.canCancel ?? true;
  const loadFailure = isLoadFailure(props.orderTimes.state);
  const initialInstant = useMemo(
    () => selectedInstant(props.cart, props.orderTimes),
    [props.cart, props.orderTimes],
  );
  const [activeDate, setActiveDate] = useState(() =>
    initialDate(props.orderTimes, initialInstant),
  );
  const [draftInstant, setDraftInstant] = useState(initialInstant);
  const [pending, setPending] = useState(false);
  const [issue, setIssue] = useState<string | null>(() =>
    loadFailure ? messages.state[props.orderTimes.state] : null,
  );
  const [actionState, setActionState] = useState<OrderTimeState | null>(() =>
    loadFailure ? props.orderTimes.state : null,
  );
  const [retryRemaining, setRetryRemaining] = useState<number>(() =>
    "retryAfterSeconds" in props.orderTimes
      ? props.orderTimes.retryAfterSeconds ?? 0
      : 0,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const issueRef = useRef<HTMLParagraphElement>(null);
  const scheduledDays = props.orderTimes.scheduleAllowed
    ? props.orderTimes.days
    : [];
  const activeDay = scheduledDays.find((day) => day.date === activeDate);
  const label = selectionLabel(props.orderTimes, draftInstant);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (retryRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setRetryRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [retryRemaining]);

  useEffect(() => {
    if (issue) issueRef.current?.focus();
  }, [issue]);

  function chooseInstant(instant: string) {
    setDraftInstant(instant);
    setIssue(null);
    setActionState(null);
    setRetryRemaining(0);
  }

  async function confirm() {
    if (!draftInstant || pending || retryRemaining > 0) return;
    const payload = payloadFor(props.orderTimes, draftInstant);
    if (!payload) {
      setActionState("error");
      setIssue(messages.missingSlot);
      return;
    }
    setPending(true);
    setIssue(null);
    try {
      const result = await updateOrderTime(props.runtime, props.locationId, payload);
      if (result.state === "ready" && result.cart) {
        props.onScheduled(result.cart);
        return;
      }
      if (result.cart) props.onCartRefreshed(result.cart);
      setActionState(result.state);
      setRetryRemaining(result.retryAfterSeconds ?? 0);
      setIssue(
        result.state === "ready"
          ? messages.missingCart
          : messages.state[result.state as keyof typeof messages.state] ?? null,
      );
    } catch {
      setActionState("error");
      setIssue(messages.updateFailed);
    } finally {
      setPending(false);
    }
  }

  const terminal = actionState === "expired" || actionState === "immutable";
  const confirmLabel = loadFailure
    ? retryRemaining > 0
      ? messages.retryIn(retryRemaining)
      : messages.reloadOrderTimes
    : pending
    ? messages.confirming
    : retryRemaining > 0
      ? messages.retryIn(retryRemaining)
      : !label
        ? messages.chooseTime
        : issue
          ? messages.retrySelection(label)
          : messages.confirm(label);

  return (
    <section className={styles.surface} aria-labelledby="checkout-scheduling-title">
      {canCancel ? (
        <button className={styles.back} type="button" onClick={props.onCancel} aria-label={messages.back}>
          <ArrowLeft aria-hidden="true" />
        </button>
      ) : null}
      <h1 id="checkout-scheduling-title" ref={headingRef} tabIndex={-1}>{messages.title}</h1>
      {props.orderTimes.state === "closed" ? (
        <p className={styles.closed} role="status">
          {props.orderTimes.readinessReason ?? messages.defaultClosed}
        </p>
      ) : null}
      {!loadFailure && !props.orderTimes.scheduleAllowed && !props.orderTimes.allowAsap ? (
        <p className={styles.closed} role="status">{messages.noTimes}</p>
      ) : null}
      {issue ? (
        <p className={styles.issue} role="alert" ref={issueRef} tabIndex={-1}>
          {issue}
        </p>
      ) : null}

      {props.orderTimes.allowAsap && props.orderTimes.state === "ready" ? (
        <fieldset className={styles.asap} disabled={pending || terminal}>
          <legend>{messages.pickupTiming}</legend>
          <label>
            <input
              className="sr-only"
              type="radio"
              name="checkout-order-time"
              checked={draftInstant === "asap"}
              onChange={() => chooseInstant("asap")}
            />
            <span>{messages.asap}</span>
          </label>
        </fieldset>
      ) : null}

      {scheduledDays.length ? (
        <>
          <div className={styles.days} aria-label={messages.orderDays}>
            {scheduledDays.map((day) => (
              <button
                className={styles.day}
                type="button"
                key={day.date}
                aria-label={`${day.label} ${dayDateLabel(day.date, props.locale)}`}
                aria-pressed={day.date === activeDate}
                onClick={() => setActiveDate(day.date)}
              >
                <span>{day.label}</span>
                <small>{dayDateLabel(day.date, props.locale)}</small>
              </button>
            ))}
          </div>
          <fieldset className={styles.slotGroup} disabled={pending || terminal}>
            <legend>{activeDay?.label ?? messages.availableTimes}</legend>
            <div className={styles.slots}>
              {activeDay?.slots.map((slot) => (
                <label className={styles.slot} key={slot.instant}>
                  <input
                    className="sr-only"
                    type="radio"
                    name="checkout-order-time"
                    checked={draftInstant === slot.instant}
                    disabled={slot.available === false}
                    onChange={() => chooseInstant(slot.instant)}
                  />
                  <span>{slot.label}</span>
                  {slot.available === false ? <small>{messages.unavailable}</small> : null}
                </label>
              ))}
            </div>
            {!activeDay?.slots.length ? <p role="status">{messages.noReturnedTimes}</p> : null}
          </fieldset>
        </>
      ) : null}

      <div className={`${styles.action} ${canCancel ? "" : styles.requiredAction}`}>
        {canCancel ? (
          <button className={styles.cancel} type="button" onClick={props.onCancel} disabled={pending}>
            {messages.cancel}
          </button>
        ) : null}
        <button
          className={styles.confirm}
          type="button"
          disabled={loadFailure
            ? retryRemaining > 0 || !props.onReload
            : !draftInstant || pending || retryRemaining > 0 || Boolean(terminal)}
          onClick={() => {
            if (loadFailure) {
              props.onReload?.();
              return;
            }
            void confirm();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </section>
  );
}
