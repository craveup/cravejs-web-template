"use client";

import type { StorefrontCart } from "@craveup/storefront-sdk";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { useHydrated } from "@/lib/storefront/use-hydrated";

import { describeFulfillmentMutationError } from "./fulfillment-mutation-error";
import styles from "./fulfillment-details.module.css";

export type TableNumber = string;
type TableMutationCart = Pick<StorefrontCart, "tableServiceInfo">;

export type SetTableAction = (
  tableNumber: TableNumber,
) => TableMutationCart | Promise<TableMutationCart>;

export function TableConfirmation({
  initialTableIdentifier = "",
  locationLabel,
  onSubmit,
}: {
  initialTableIdentifier?: string;
  locationLabel?: string;
  onSubmit?: SetTableAction;
}) {
  const hydrated = useHydrated();
  const [tableIdentifier, setTableIdentifier] = useState(initialTableIdentifier);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmedTableNumber, setConfirmedTableNumber] = useState("");
  const [editingTable, setEditingTable] = useState(
    !initialTableIdentifier.trim(),
  );
  const submissionInFlight = useRef(false);
  const tableInputRef = useRef<HTMLInputElement>(null);
  const focusTableAfterEdit = useRef(false);

  useEffect(() => {
    if (!editingTable || !focusTableAfterEdit.current) return;
    focusTableAfterEdit.current = false;
    tableInputRef.current?.focus();
  }, [editingTable]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!hydrated || submissionInFlight.current) return;
    const value = tableIdentifier.trim();
    if (!value) {
      flushSync(() => setError("Enter your table number."));
      tableInputRef.current?.focus();
      return;
    }
    if (!onSubmit) return;
    setError("");
    setConfirmedTableNumber("");
    submissionInFlight.current = true;
    setPending(true);
    try {
      const returnedCart = await onSubmit(value);
      const authoritativeTableNumber = returnedCart.tableServiceInfo?.tableNumber?.trim() ?? "";
      if (!authoritativeTableNumber) {
        setError("The cart response did not confirm a table. Refresh and try again.");
        return;
      }
      setConfirmedTableNumber(authoritativeTableNumber);
    } catch (caught) {
      setError(describeFulfillmentMutationError(caught, "table"));
    } finally {
      submissionInFlight.current = false;
      setPending(false);
    }
  }

  return (
    <main className={styles.surface}>
      <h1 className="sr-only">Confirm your table</h1>
      <section className={styles.detailCard} aria-label="Current table intent">
        <span>YOU ARE AT</span>
        <strong>Table {tableIdentifier.trim() || "—"}</strong>
        {locationLabel ? <p>{locationLabel}</p> : null}
      </section>
      <section className={styles.ownTabOption} aria-label="Supported table ordering option">
        <span>
          <strong>Start my own tab</strong>
          <small>You pay separately for just your items.</small>
        </span>
        <span className={styles.selectedIndicator} aria-hidden="true" />
      </section>
      <form className={styles.form} onSubmit={submit} noValidate>
        {editingTable ? (
        <label className={styles.field}>
          Table number
          <input
            ref={tableInputRef}
            disabled={!hydrated}
            value={tableIdentifier}
            onChange={(event) => {
              setTableIdentifier(event.target.value);
              setError("");
              setConfirmedTableNumber("");
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "table-error" : undefined}
          />
        </label>
        ) : (
          <button
            className={styles.wrongTable}
            type="button"
            disabled={!hydrated}
            onClick={() => {
              focusTableAfterEdit.current = true;
              setEditingTable(true);
            }}
          >
            Wrong table?
          </button>
        )}
        {error ? (
          <p className={styles.error} id="table-error" role="alert">
            {error}
          </p>
        ) : null}
        {confirmedTableNumber ? (
          <p className={styles.status} role="status" aria-live="polite">
            Table {confirmedTableNumber} was confirmed by the current cart.
          </p>
        ) : null}
        <p className={styles.preview}>
          PREVIEW ONLY — table detail persistence awaits platform evidence.
        </p>
        <button
          className={styles.submit}
          type="submit"
          aria-label={pending ? "Confirming…" : "Start my own tab"}
          disabled={!hydrated || pending || !onSubmit}
        >
          {pending
            ? "Confirming…"
            : `Start my own tab${tableIdentifier.trim() ? ` at Table ${tableIdentifier.trim()}` : ""}`}
        </button>
      </form>
    </main>
  );
}
