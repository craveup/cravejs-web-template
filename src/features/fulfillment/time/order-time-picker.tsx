"use client";

import { useEffect, useState } from "react";

import { useHydrated } from "@/lib/storefront/use-hydrated";

import styles from "./order-time-picker.module.css";

export interface OrderTimeSlot {
  instant: string;
  label: string;
  orderDate: string;
  orderTime: string;
  available?: boolean;
}

export interface OrderTimeDay {
  date: string;
  label: string;
  slots: readonly OrderTimeSlot[];
}

export type OrderTimeState =
  | "ready"
  | "pending"
  | "closed"
  | "conflict"
  | "expired"
  | "immutable"
  | "rate-limited"
  | "processing"
  | "unavailable"
  | "error";

export interface OrderTimeActionResult {
  readonly state: OrderTimeState;
  readonly retryAfterSeconds?: number;
}

export type OrderTimeSelection =
  | "asap"
  | Readonly<{ instant: string; orderDate: string; orderTime: string }>;

export interface OrderTimePickerProps {
  days: readonly OrderTimeDay[];
  state?: OrderTimeState;
  allowAsap?: boolean;
  closedReason?: string;
  selectedInstant?: string;
  onSelect?: (
    selection: OrderTimeSelection,
  ) =>
    | OrderTimeState
    | OrderTimeActionResult
    | void
    | Promise<OrderTimeState | OrderTimeActionResult | void>;
  onRetry?: () => void | Promise<void>;
}

const stateCopy: Partial<Record<OrderTimeState, string>> = {
  pending: "Loading available order times…",
  closed: "Pick a returned time and we will have it ready when ordering resumes.",
  conflict: "The order changed elsewhere. Refresh the order before choosing a time again.",
  expired: "This order has expired. Start a new order to choose an order time.",
  immutable: "The order time can no longer be changed.",
  "rate-limited": "Order-time updates are temporarily rate limited.",
  processing: "Your order-time update is still being processed.",
  unavailable: "Order-time updates are temporarily unavailable.",
  error: "Order times could not be loaded.",
};

export function OrderTimePicker(props: OrderTimePickerProps) {
  const resetKey = JSON.stringify([
    props.selectedInstant,
    props.state,
    props.days.map((day) => [
      day.date,
      day.slots.map((slot) => [slot.instant, slot.available]),
    ]),
  ]);
  return <OrderTimePickerState key={resetKey} {...props} />;
}

function OrderTimePickerState({
  days,
  state = "ready",
  allowAsap = false,
  closedReason,
  selectedInstant,
  onSelect,
  onRetry,
}: OrderTimePickerProps) {
  const hydrated = useHydrated();
  const [selectionPending, setSelectionPending] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [draftInstant, setDraftInstant] = useState(selectedInstant);
  const [actionState, setActionState] = useState<OrderTimeState | undefined>();
  const [retryRemaining, setRetryRemaining] = useState(0);
  const effectiveState = actionState ?? state;
  const actionLocked =
    !hydrated ||
    effectiveState === "pending" ||
    effectiveState === "conflict" ||
    effectiveState === "expired" ||
    effectiveState === "immutable" ||
    effectiveState === "error" ||
    retryRemaining > 0 ||
    selectionPending;
  const selectionLocked =
    actionLocked ||
    effectiveState === "rate-limited" ||
    effectiveState === "processing" ||
    effectiveState === "unavailable";

  useEffect(() => {
    if (retryRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setRetryRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [retryRemaining]);

  async function confirmSelection() {
    if (!hydrated || !onSelect || !draftInstant || actionLocked) return;
    setSelectionPending(true);
    setSelectionError("");
    try {
      const slot = days
        .flatMap((day) => day.slots)
        .find((candidate) => candidate.instant === draftInstant);
      const result = await onSelect(
        draftInstant === "asap"
          ? "asap"
          : slot
            ? {
                instant: slot.instant,
                orderDate: slot.orderDate,
                orderTime: slot.orderTime,
              }
            : "asap",
      );
      if (typeof result === "string") {
        setActionState(result);
        setRetryRemaining(0);
      } else if (result) {
        setActionState(result.state);
        setRetryRemaining(result.retryAfterSeconds ?? 0);
      }
    } catch {
      setDraftInstant(selectedInstant);
      setSelectionError("Order time could not be updated. Try again.");
    } finally {
      setSelectionPending(false);
    }
  }

  async function retry() {
    if (!hydrated || !onRetry) return;
    setSelectionPending(true);
    setSelectionError("");
    try {
      await onRetry();
      setActionState("ready");
    } catch {
      setSelectionError("Order times could not be refreshed. Try again.");
    } finally {
      setSelectionPending(false);
    }
  }

  return (
    <main className={styles.surface}>
      {effectiveState === "closed" && closedReason ? (
        <p className={styles.closedBanner}>{closedReason}</p>
      ) : null}
      <h1>{effectiveState === "closed" ? "You can still schedule an order" : "When do you want it?"}</h1>
      {stateCopy[effectiveState] ? (
        <p className={styles.status} role="status">
          {stateCopy[effectiveState]}
        </p>
      ) : null}
      {selectionError ? (
        <p className={styles.status} role="status" aria-live="polite">
          {selectionError}
        </p>
      ) : null}
      {(effectiveState === "error" || effectiveState === "conflict") && onRetry ? (
        <button
          className={styles.retry}
          type="button"
          disabled={!hydrated || selectionPending}
          onClick={retry}
        >
          Try again
        </button>
      ) : null}
      {allowAsap ? (
        <fieldset className={`${styles.day} ${styles.asap}`} disabled={selectionLocked}>
          <legend>As soon as possible</legend>
          <label className={styles.slot}>
            <input
              className="sr-only"
              type="radio"
              name="order-time"
              value="asap"
              aria-label="ASAP"
              checked={draftInstant === "asap"}
              onChange={() => setDraftInstant("asap")}
            />
            <span>
              <strong>Ready as soon as possible</strong>
              <small>We will start as soon as you place the order.</small>
            </span>
          </label>
        </fieldset>
      ) : null}
      {days.map((day) => (
        <fieldset className={styles.day} disabled={selectionLocked} key={day.date}>
          <legend>{day.label}</legend>
          <div className={styles.slots}>
            {day.slots.map((slot) => (
              <label className={styles.slot} key={slot.instant}>
                <input
                  className="sr-only"
                  type="radio"
                  name="order-time"
                  value={slot.instant}
                  aria-label={slot.label}
                  checked={draftInstant === slot.instant}
                  disabled={selectionLocked || slot.available === false}
                  aria-describedby={
                    slot.available === false ? `${slot.instant}-unavailable` : undefined
                  }
                  onChange={() => setDraftInstant(slot.instant)}
                />
                <span>{slot.label}</span>
                <strong className={styles.selectLabel} aria-hidden="true">
                  {draftInstant === slot.instant ? "Selected" : "Select"}
                </strong>
                {slot.available === false ? (
                  <span className="sr-only" id={`${slot.instant}-unavailable`}>
                    {" "}unavailable
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {!days.length && state === "ready" ? <p role="status">No order times are available.</p> : null}
      <div className={styles.action}>
        <button
          type="button"
          disabled={!onSelect || actionLocked || !draftInstant}
          onClick={confirmSelection}
        >
          {selectionPending
            ? "Confirming…"
            : retryRemaining > 0
              ? `Try again in ${retryRemaining}s`
            : effectiveState === "closed"
              ? "Schedule an order"
              : "Confirm pickup time"}
        </button>
      </div>
    </main>
  );
}
