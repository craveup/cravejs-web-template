"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { fulfillmentRoutes } from "../routes";
import type { NormalizedAddress } from "../types";
import { publishedDeliveryHandoffContract } from "./delivery-handoff-contract";
import styles from "./delivery-handoff.module.css";

export type DeliveryHandoffMethod = "leave-at-door" | "hand-to-me" | "meet-outside";

export interface DeliveryHandoffPayload {
  handoffMethod?: DeliveryHandoffMethod;
  note?: string;
}

export interface DeliveryHandoffCapabilities {
  handoffMethod?: true;
  note?: {
    /** The authoritative value returned by the accepted public cart contract. */
    currentValue: string;
    writable: boolean;
    readable: boolean;
    clearable: boolean;
  };
}

export interface DeliveryHandoffProps {
  locationId: string;
  address?: NormalizedAddress;
  capabilities?: DeliveryHandoffCapabilities;
  onSubmit?: (payload: DeliveryHandoffPayload) => void | Promise<void>;
}

const methods: Array<{ value: DeliveryHandoffMethod; label: string; description: string }> = [
  {
    value: "leave-at-door",
    label: "Leave at my door",
    description: "Leave the order at the delivery address.",
  },
  {
    value: "hand-to-me",
    label: "Hand it to me",
    description: "Give the order to someone at the address.",
  },
  {
    value: "meet-outside",
    label: "Meet me outside",
    description: "Meet outside the delivery address.",
  },
];

function describeAddress(address: NormalizedAddress | undefined) {
  if (!address) {
    return { primary: "No delivery address selected", secondary: "" };
  }

  const primary = address.street?.trim() || address.formattedLabel.trim();
  const regionAndPostcode = [address.region?.trim(), address.postcode?.trim()]
    .filter(Boolean)
    .join(" ");
  const locality = [address.city?.trim(), regionAndPostcode].filter(Boolean).join(", ");
  const secondary = [locality, address.streetOptional?.trim()].filter(Boolean).join(" · ");

  return { primary, secondary };
}

export function DeliveryHandoff({
  locationId,
  address,
  capabilities,
  onSubmit,
}: DeliveryHandoffProps) {
  const handoffMethodSupported =
    publishedDeliveryHandoffContract.handoffMethod.writable &&
    capabilities?.handoffMethod === true;
  const noteCapability = capabilities?.note;
  const noteSupported = Boolean(
    publishedDeliveryHandoffContract.note.writable &&
    publishedDeliveryHandoffContract.note.readable &&
    publishedDeliveryHandoffContract.note.clearable &&
    noteCapability?.writable &&
    noteCapability.readable &&
    noteCapability.clearable,
  );
  const [method, setMethod] = useState<DeliveryHandoffMethod>();
  const [note, setNote] = useState(
    noteSupported ? noteCapability?.currentValue ?? "" : "",
  );
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const supported = handoffMethodSupported || noteSupported;
  const normalizedNote = note.trim();
  const noteChanged = noteSupported && normalizedNote !== noteCapability?.currentValue.trim();
  const hasChange = (handoffMethodSupported && Boolean(method)) || noteChanged;
  const enabled = supported && hasChange && Boolean(onSubmit);
  const addressSummary = describeAddress(address);
  const unavailableDescriptionId = !supported
    ? "delivery-handoff-unavailable"
    : !onSubmit
      ? "delivery-handoff-adapter-unavailable"
      : undefined;

  async function submit() {
    const payload: DeliveryHandoffPayload = {};
    if (handoffMethodSupported && method) payload.handoffMethod = method;
    if (noteChanged) payload.note = normalizedNote;
    if (!onSubmit) return;
    setPending(true);
    try {
      await onSubmit(payload);
      setStatus("Delivery instructions saved by the current adapter.");
    } catch {
      setStatus("Delivery instructions could not be saved. Review them and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.surface}>
      <h1>Delivery details</h1>
      <section className={styles.summary} aria-label="Delivery address">
        <div className={styles.summaryText}>
          <strong>{addressSummary.primary}</strong>
          {addressSummary.secondary ? <p>{addressSummary.secondary}</p> : null}
        </div>
        <a href={fulfillmentRoutes.address(locationId)} aria-label="Change address">
          Change
        </a>
      </section>
      <fieldset
        className={styles.options}
        disabled={!handoffMethodSupported}
        aria-describedby={unavailableDescriptionId}
      >
        <legend>How should we hand it over?</legend>
        {methods.map(({ value, label, description }) => (
          <label
            className={
              method === value ? `${styles.option} ${styles.optionSelected}` : styles.option
            }
            key={value}
          >
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <input
              type="radio"
              name="handoff"
              value={value}
              checked={method === value}
              onChange={() => setMethod(value)}
            />
          </label>
        ))}
      </fieldset>
      <label className={styles.note}>
        Instructions for the courier
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={!noteSupported}
          placeholder="Gate code, buzzer, which door…"
          aria-describedby={unavailableDescriptionId}
          rows={1}
        />
      </label>
      {!supported ? (
        <p
          className={styles.explanation}
          id="delivery-handoff-unavailable"
          role="status"
        >
          Handoff choices and courier instructions are not available in the current storefront
          contract. Nothing will be sent.
        </p>
      ) : !onSubmit ? (
        <p
          className={styles.explanation}
          id="delivery-handoff-adapter-unavailable"
          role="status"
        >
          Delivery instructions are unavailable until the storefront cart adapter is connected.
        </p>
      ) : null}
      {status ? (
        <p className={styles.explanation} role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
      <div className={styles.actionBar}>
        <Button
          className={styles.submit}
          disabled={!enabled || pending}
          onClick={submit}
        >
          {pending ? "Saving…" : "Save and continue"}
        </Button>
      </div>
    </main>
  );
}

export { publishedDeliveryHandoffContract };
