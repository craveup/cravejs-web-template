"use client";

import type { StartOrderingSessionRequest } from "@craveup/storefront-sdk";
import { useEffect, useState } from "react";

import { useHydrated } from "@/lib/storefront/use-hydrated";

import { describeFulfillment } from "../detail";
import { toStartOrderingSessionRequest } from "../sdk-contract";
import {
  fulfillmentModeLabels,
  type FulfillmentDetail,
  type FulfillmentMode,
} from "../types";
import styles from "./mode-picker.module.css";

export type ModeSwitchStatus =
  | "success"
  | "conflict"
  | "immutable"
  | "expired"
  | "rate-limited"
  | "processing"
  | "unavailable";

export type ModeSwitchResult =
  | { status: "success"; detail: FulfillmentDetail }
  | {
      status: Exclude<ModeSwitchStatus, "success">;
      detail?: FulfillmentDetail;
      retryAfterSeconds?: number;
    };

export interface ModeSwitchRequest {
  locationId: string;
  requestedMode: FulfillmentMode;
  currentDetail: FulfillmentDetail;
  payload: StartOrderingSessionRequest;
}

export interface ModePickerProps {
  locationId: string;
  existingCartId?: string | null;
  detail: FulfillmentDetail;
  enabledModes: readonly FulfillmentMode[];
  onRequestMode?: (request: ModeSwitchRequest) => Promise<ModeSwitchResult>;
}

const statusCopy: Record<Exclude<ModeSwitchStatus, "success">, string> = {
  conflict: "The order changed elsewhere. Review the refreshed order, then retry your choice.",
  immutable: "This order can no longer change fulfillment method.",
  expired: "This order has expired. Start a new order to choose a fulfillment method.",
  "rate-limited": "Fulfillment updates are temporarily rate limited.",
  processing: "Your fulfillment update is still being processed.",
  unavailable: "Fulfillment updates are temporarily unavailable.",
};

const modeDescriptions: Record<FulfillmentMode, string> = {
  takeout: "Pick up at this location",
  delivery: "Deliver to an address",
  "table-side": "Scan the QR code on your table",
  "room-service": "For hotel guests · room details required",
};

const modeDisplayLabels: Record<FulfillmentMode, string> = {
  takeout: "Pickup",
  delivery: "Delivery",
  "table-side": "Dine in at the table",
  "room-service": "In-room delivery",
};

export function ModePicker(props: ModePickerProps) {
  return <ModePickerState key={JSON.stringify(props.detail)} {...props} />;
}

function ModePickerState({
  locationId,
  existingCartId,
  detail,
  enabledModes,
  onRequestMode,
}: ModePickerProps) {
  const hydrated = useHydrated();
  const [authoritativeDetail, setAuthoritativeDetail] = useState(detail);
  const [draftMode, setDraftMode] = useState(detail.mode);
  const [state, setState] = useState<"ready" | "pending" | "error" | ModeSwitchStatus>(
    "ready",
  );
  const [retryRemaining, setRetryRemaining] = useState(0);
  const description = describeFulfillment(authoritativeDetail, locationId);
  const actionLocked =
    !hydrated ||
    state === "pending" ||
    state === "immutable" ||
    state === "expired" ||
    retryRemaining > 0;
  const selectionLocked =
    actionLocked ||
    state === "rate-limited" ||
    state === "processing" ||
    state === "unavailable";

  useEffect(() => {
    if (retryRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setRetryRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [retryRemaining]);

  async function requestMode() {
    if (!hydrated || !onRequestMode || actionLocked) return;
    setState("pending");
    try {
      const result = await onRequestMode({
        locationId,
        requestedMode: draftMode,
        currentDetail: authoritativeDetail,
        payload: toStartOrderingSessionRequest({
          mode: draftMode,
          existingCartId,
          channel: "web",
        }),
      });
      const nextDetail = result.detail;
      if (nextDetail) {
        setAuthoritativeDetail(nextDetail);
        setDraftMode(nextDetail.mode);
      }
      setRetryRemaining(
        "retryAfterSeconds" in result ? result.retryAfterSeconds ?? 0 : 0,
      );
      setState(result.status);
    } catch {
      setState("error");
    }
  }

  return (
    <main className={styles.surface}>
      <h1>How do you want your order?</h1>
      <p className="sr-only">
        Current selection: {description.modeLabel}. {description.summary}
      </p>
      <div className={styles.modes} aria-label="Available fulfillment methods">
        {enabledModes.map((mode) => (
          <button
            className={styles.mode}
            type="button"
            key={mode}
            aria-pressed={draftMode === mode}
            disabled={selectionLocked}
            onClick={() => {
              setDraftMode(mode);
              if (state === "error" || state === "success" || state === "conflict") {
                setState("ready");
              }
            }}
          >
            <span className={styles.modeCopy}>
              <strong>{modeDisplayLabels[mode]}</strong>
              <span>{modeDescriptions[mode]}</span>
            </span>
            <span className={styles.indicator} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className={styles.status} role="status" aria-live="polite">
        {state === "pending" ? "Updating fulfillment method…" : null}
        {state === "success" ? "Fulfillment method updated from the returned order." : null}
        {state !== "ready" && state !== "pending" && state !== "success" && state !== "error"
          ? statusCopy[state]
          : null}
        {state === "error" ? "Fulfillment method could not be updated. Try again." : null}
      </div>
      <div className={styles.action}>
        <button
          type="button"
          disabled={!onRequestMode || actionLocked}
          onClick={requestMode}
        >
          {state === "pending"
            ? "Updating…"
            : retryRemaining > 0
              ? `Try again in ${retryRemaining}s`
            : `Continue with ${fulfillmentModeLabels[draftMode]}`}
        </button>
      </div>
    </main>
  );
}
