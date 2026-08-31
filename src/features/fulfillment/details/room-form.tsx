"use client";

import type { StorefrontCart } from "@craveup/storefront-sdk";
import { useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { describeFulfillmentMutationError } from "./fulfillment-mutation-error";
import styles from "./fulfillment-details.module.css";

export interface RoomSubmission {
  readonly lastName: string;
  readonly roomNumber: string;
}
type RoomMutationCart = Pick<StorefrontCart, "roomServiceInfo">;

export type SetRoomAction = (
  detail: RoomSubmission,
) => RoomMutationCart | Promise<RoomMutationCart>;

export function RoomForm({
  initialRoomIdentifier = "",
  onSubmit,
}: {
  initialRoomIdentifier?: string;
  onSubmit?: SetRoomAction;
}) {
  const [roomIdentifier, setRoomIdentifier] = useState(initialRoomIdentifier);
  const [lastName, setLastName] = useState("");
  const [errors, setErrors] = useState<{ room?: string; lastName?: string }>({});
  const [pending, setPending] = useState(false);
  const [adapterError, setAdapterError] = useState("");
  const [confirmedRoomNumber, setConfirmedRoomNumber] = useState("");
  const submissionInFlight = useRef(false);
  const roomInputRef = useRef<HTMLInputElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    const room = roomIdentifier.trim();
    const name = lastName.trim();
    const nextErrors = {
      room: room ? undefined : "Enter your room number.",
      lastName: name ? undefined : "Enter the last name for the room.",
    };
    if (!room || !name) {
      flushSync(() => setErrors(nextErrors));
      (room ? lastNameInputRef : roomInputRef).current?.focus();
      return;
    }
    setErrors(nextErrors);
    if (!onSubmit) return;
    submissionInFlight.current = true;
    setPending(true);
    setAdapterError("");
    setConfirmedRoomNumber("");
    try {
      const returnedCart = await onSubmit({ roomNumber: room, lastName: name });
      const authoritativeRoomNumber = returnedCart.roomServiceInfo?.roomNumber?.trim() ?? "";
      const authoritativeLastName = returnedCart.roomServiceInfo?.lastName?.trim() ?? "";
      if (!authoritativeRoomNumber || !authoritativeLastName) {
        setAdapterError(
          "The cart response did not confirm the room details. Refresh and try again.",
        );
        return;
      }
      setConfirmedRoomNumber(authoritativeRoomNumber);
    } catch (caught) {
      setAdapterError(describeFulfillmentMutationError(caught, "room"));
    } finally {
      submissionInFlight.current = false;
      setPending(false);
    }
  }

  return (
    <main className={styles.surface}>
      <h1>Which room are you in?</h1>
      <p className={styles.introduction}>
        We use these details to confirm room-service delivery.
      </p>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Room number
          <input
            ref={roomInputRef}
            value={roomIdentifier}
            onChange={(event) => {
              setRoomIdentifier(event.target.value);
              setErrors((current) => ({ ...current, room: undefined }));
              setAdapterError("");
              setConfirmedRoomNumber("");
            }}
            aria-invalid={Boolean(errors.room)}
            aria-describedby={errors.room ? "room-error" : undefined}
          />
        </label>
        {errors.room ? (
          <p className={styles.error} id="room-error" role="alert">
            {errors.room}
          </p>
        ) : null}
        <label className={styles.field}>
          Last name on the booking
          <input
            ref={lastNameInputRef}
            autoComplete="family-name"
            placeholder="Enter the booking last name"
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              setErrors((current) => ({ ...current, lastName: undefined }));
              setAdapterError("");
              setConfirmedRoomNumber("");
            }}
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? "last-name-error" : undefined}
          />
        </label>
        {errors.lastName ? (
          <p className={styles.error} id="last-name-error" role="alert">
            {errors.lastName}
          </p>
        ) : null}
        {adapterError ? (
          <p className={styles.error} role="alert">
            {adapterError}
          </p>
        ) : null}
        {confirmedRoomNumber ? (
          <p className={styles.status} role="status" aria-live="polite">
            Room {confirmedRoomNumber} was confirmed by the current cart.
          </p>
        ) : null}
        <p className={styles.preview}>
          PREVIEW ONLY — room detail persistence awaits platform evidence.
        </p>
        <button className={styles.submit} type="submit" disabled={pending || !onSubmit}>
          {pending ? "Confirming…" : "Continue to the menu"}
        </button>
      </form>
    </main>
  );
}
