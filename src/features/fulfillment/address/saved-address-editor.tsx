"use client";

import type {
  CustomerAddress,
  CustomerAddressInput,
} from "@craveup/storefront-sdk";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";

import {
  getSavedAddressesMessages,
  type SavedAddressEditorMessages,
} from "./saved-addresses.messages";
import styles from "./saved-address-editor.module.css";

interface AddressDraft {
  fullAddress: string;
  line1: string;
  line2: string;
  line3: string;
  lat: string;
  lng: string;
}

type AddressDraftField = keyof AddressDraft;
type AddressErrors = Partial<Record<AddressDraftField, string>>;

export interface SavedAddressEditorProps {
  address?: CustomerAddress;
  pending?: boolean;
  retryAfterSeconds?: number;
  remoteError?: string | null;
  messages?: SavedAddressEditorMessages;
  onCancel: () => void;
  onSubmit: (payload: CustomerAddressInput) => void | Promise<void>;
}

function initialDraft(address?: CustomerAddress): AddressDraft {
  return {
    fullAddress: address?.fullAddress ?? "",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    line3: address?.line3 ?? "",
    lat: address ? String(address.lat) : "",
    lng: address ? String(address.lng) : "",
  };
}

function validateDraft(
  draft: AddressDraft,
  messages: SavedAddressEditorMessages,
): {
  errors: AddressErrors;
  payload?: CustomerAddressInput;
} {
  const errors: AddressErrors = {};
  const fullAddress = draft.fullAddress.trim();
  const line1 = draft.line1.trim();
  const line2 = draft.line2.trim();
  const line3 = draft.line3.trim();
  const latitude = draft.lat.trim();
  const longitude = draft.lng.trim();
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!fullAddress) errors.fullAddress = messages.completeAddressRequired;
  else if (fullAddress.length > 500) {
    errors.fullAddress = messages.completeAddressLength;
  }
  if (!line1) errors.line1 = messages.line1Required;
  else if (line1.length > 200) {
    errors.line1 = messages.line1Length;
  }
  if (line2.length > 200) {
    errors.line2 = messages.line2Length;
  }
  if (line3.length > 200) {
    errors.line3 = messages.line3Length;
  }
  if (!latitude || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.lat = messages.latitudeInvalid;
  }
  if (!longitude || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    errors.lng = messages.longitudeInvalid;
  }

  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    payload: {
      fullAddress,
      line1,
      ...(line2 ? { line2 } : {}),
      ...(line3 ? { line3 } : {}),
      lat,
      lng,
    },
  };
}

export function SavedAddressEditor({
  address,
  pending = false,
  retryAfterSeconds = 0,
  remoteError,
  messages = getSavedAddressesMessages().editor,
  onCancel,
  onSubmit,
}: SavedAddressEditorProps) {
  const [draft, setDraft] = useState(() => initialDraft(address));
  const [errors, setErrors] = useState<AddressErrors>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    const returnTarget = returnFocusRef.current;
    headingRef.current?.focus();
    return () => {
      window.setTimeout(() => {
        if (
          returnTarget?.isConnected &&
          !(returnTarget instanceof HTMLButtonElement && returnTarget.disabled)
        ) {
          returnTarget.focus();
        }
      }, 0);
    };
  }, []);

  function update(field: AddressDraftField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || retryAfterSeconds > 0) return;
    const result = validateDraft(draft, messages);
    setErrors(result.errors);
    if (!result.payload) {
      window.setTimeout(() => {
        formRef.current
          ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
          ?.focus();
      }, 0);
      return;
    }
    await onSubmit(result.payload);
  }

  function fieldProps(field: AddressDraftField) {
    return {
      value: draft[field],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        update(field, event.target.value),
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": errors[field] ? `${field}-error` : undefined,
      disabled: pending,
    };
  }

  return (
    <section
      className={styles.editor}
      aria-labelledby="saved-address-editor-heading"
    >
      <h2
        id="saved-address-editor-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        {address ? messages.editHeading : messages.createHeading}
      </h2>
      <p className={styles.description}>
        {messages.description}
      </p>
      {remoteError ? (
        <p className={styles.errorSummary} role="alert">
          {remoteError}
        </p>
      ) : null}
      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          {messages.fullAddress}
          <input
            {...fieldProps("fullAddress")}
            autoComplete="street-address"
            maxLength={500}
          />
          {errors.fullAddress ? (
            <span id="fullAddress-error">{errors.fullAddress}</span>
          ) : null}
        </label>
        <label className={styles.field}>
          {messages.line1}
          <input
            {...fieldProps("line1")}
            autoComplete="address-line1"
            maxLength={200}
          />
          {errors.line1 ? (
            <span id="line1-error">{errors.line1}</span>
          ) : null}
        </label>
        <label className={styles.field}>
          {messages.line2}
          <input
            {...fieldProps("line2")}
            autoComplete="address-line2"
            maxLength={200}
          />
          {errors.line2 ? (
            <span id="line2-error">{errors.line2}</span>
          ) : null}
        </label>
        <label className={styles.field}>
          {messages.line3}
          <input
            {...fieldProps("line3")}
            autoComplete="address-level2"
            maxLength={200}
          />
          {errors.line3 ? (
            <span id="line3-error">{errors.line3}</span>
          ) : null}
        </label>
        <div className={styles.coordinateFields}>
          <label className={styles.field}>
            {messages.latitude}
            <input {...fieldProps("lat")} inputMode="decimal" />
            {errors.lat ? <span id="lat-error">{errors.lat}</span> : null}
          </label>
          <label className={styles.field}>
            {messages.longitude}
            <input {...fieldProps("lng")} inputMode="decimal" />
            {errors.lng ? <span id="lng-error">{errors.lng}</span> : null}
          </label>
        </div>
        <div className={styles.actions}>
          <Button type="submit" disabled={pending || retryAfterSeconds > 0}>
            {pending
              ? messages.saving
              : retryAfterSeconds > 0
                ? messages.retryIn(retryAfterSeconds)
                : messages.save}
          </Button>
          <button type="button" onClick={onCancel} disabled={pending}>
            {messages.cancel}
          </button>
        </div>
      </form>
    </section>
  );
}
