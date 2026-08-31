import type { StorefrontErrorState } from "@/lib/storefront/error-state";
import type { FulfillmentMode } from "../types";

export interface EntrySessionBootstrapMessages {
  readonly starting: string;
  readonly restarting: string;
  readonly ready: string;
  readonly retryLabel: string;
  readonly retryIn: (seconds: number) => string;
  readonly startNewOrderLabel: string;
  readonly error: Readonly<Record<StorefrontErrorState["state"], string>>;
}

const modeLabels: Readonly<Record<FulfillmentMode, string>> = {
  takeout: "pickup",
  delivery: "delivery",
  "table-side": "table service",
  "room-service": "room service",
};

function enUsEntrySessionBootstrapMessages(
  mode: FulfillmentMode,
): EntrySessionBootstrapMessages {
  const label = modeLabels[mode];
  const sentenceLabel = `${label[0]?.toUpperCase() ?? ""}${label.slice(1)}`;
  return {
    starting: `Starting ${label} ordering session.`,
    restarting: `Starting ${label} again.`,
    ready: `${sentenceLabel} ordering session ready.`,
    retryLabel: `Try ${label} again`,
    retryIn: (seconds) =>
      `Try ${label} again in ${seconds} ${seconds === 1 ? "second" : "seconds"}`,
    startNewOrderLabel: "Start a new order",
    error: {
      validation: `${sentenceLabel} could not be started with this location.`,
      "authentication-required": "Sign in again before starting this order.",
      "access-denied": "This order session is no longer available.",
      unavailable: `${sentenceLabel} is not available for this location.`,
      "rate-limited": `${sentenceLabel} is temporarily busy. Wait a moment and try again.`,
      "cart-conflict": "Your saved order changed. Start a new order to continue.",
      "resource-conflict": `${sentenceLabel} could not be started because the location changed.`,
      "cart-immutable": "This order can no longer be changed. Start a new order to continue.",
      "integration-error": `${sentenceLabel} could not be started safely.`,
      "operation-pending": `${sentenceLabel} is already being started. Wait for it to finish.`,
      "dependency-unavailable": `${sentenceLabel} is temporarily unavailable. Try again shortly.`,
      "network-error": `We could not start ${label}. Check your connection and try again.`,
      unexpected: `We could not start ${label}. Try again.`,
    },
  };
}

export function getEntrySessionBootstrapMessages(
  locale: string,
  mode: FulfillmentMode = "takeout",
): EntrySessionBootstrapMessages {
  void locale;
  return enUsEntrySessionBootstrapMessages(mode);
}
