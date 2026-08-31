"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { NormalizedAddress } from "../types";
import { evaluateServiceability, type DeliveryPolicy } from "./serviceability";
import { SavedAddressSelectionError } from "./saved-address-delivery";
import {
  getSavedAddressesMessages,
  type SavedAddressesMessages,
} from "./saved-addresses.messages";
import styles from "./saved-addresses.module.css";

export interface SavedAddress {
  id: string;
  revision: number;
  label?: string;
  formattedLabel: string;
  street?: string;
  streetOptional?: string;
  city?: string;
  region?: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  postcode?: string;
}

export interface SavedAddressDeleteIntent {
  addressId: string;
  revision: number;
}

export type SavedAddressView =
  | "ready"
  | "signed-out"
  | "pending"
  | "conflict"
  | "error";

export interface SavedAddressesProps {
  addresses: readonly SavedAddress[];
  policy?: DeliveryPolicy;
  view?: SavedAddressView;
  selectedId?: string;
  nextCursor?: string;
  showDeliveryAction?: boolean;
  retryAfterSeconds?: number;
  messages?: SavedAddressesMessages;
  onSelect?: (address: SavedAddress) => void | Promise<void>;
  onCreate?: () => void;
  onEdit?: (address: SavedAddress) => void;
  onDelete?: (intent: SavedAddressDeleteIntent) => void | Promise<void>;
  onLoadMore?: (cursor: string) => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
}

export function SavedAddresses(props: SavedAddressesProps) {
  return <SavedAddressesState {...props} />;
}

function SavedAddressesState({
  addresses,
  policy,
  view = "ready",
  selectedId,
  nextCursor,
  showDeliveryAction = true,
  retryAfterSeconds = 0,
  messages = getSavedAddressesMessages(),
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onLoadMore,
  onRetry,
}: SavedAddressesProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>();
  const [status, setStatus] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [selection, setSelection] = useState(() => ({
    sourceId: selectedId,
    draftId: selectedId ?? addresses[0]?.id,
  }));
  const selectionOutOfDate = selection.sourceId !== selectedId;
  if (selectionOutOfDate) {
    setSelection({
      sourceId: selectedId,
      draftId: selectedId ?? addresses[0]?.id,
    });
  }
  const draftSelectedId = selectionOutOfDate
    ? selectedId ?? addresses[0]?.id
    : selection.draftId;
  const mutationsUnavailable =
    view !== "ready" || actionPending || retryAfterSeconds > 0;
  const resolvedSelectedId =
    addresses.some((address) => address.id === draftSelectedId)
      ? draftSelectedId
      : addresses.some((address) => address.id === selectedId)
        ? selectedId
        : addresses[0]?.id;
  const resolvedConfirmDeleteId = addresses.some(
    (address) => address.id === confirmDeleteId,
  )
    ? confirmDeleteId
    : undefined;
  const draftSelectedAddress = addresses.find(
    (address) => address.id === resolvedSelectedId,
  );

  async function runAction(
    action: (() => void | Promise<void>) | undefined,
    success: string,
  ) {
    if (!action) return;
    setActionPending(true);
    try {
      await action();
      setStatus(success);
    } catch (error) {
      setStatus(
        error instanceof SavedAddressSelectionError
          ? error.message
          : messages.actionError,
      );
    } finally {
      setActionPending(false);
    }
  }

  async function confirmSelection() {
    const address = draftSelectedAddress;
    if (!address) return;
    if (!policy) {
      setStatus(messages.policyUnavailable);
      return;
    }
    if (address.countryCode) {
      const normalizedAddress: NormalizedAddress = {
        formattedLabel: address.formattedLabel,
        street: address.street,
        streetOptional: address.streetOptional,
        city: address.city,
        region: address.region,
        latitude: address.latitude,
        longitude: address.longitude,
        countryCode: address.countryCode,
        postcode: address.postcode,
      };
      const result = evaluateServiceability(normalizedAddress, policy);
      if (!result.serviceable) {
        setStatus(messages.outsidePolicy(policy.policyLabel));
        return;
      }
    }
    await runAction(
      onSelect ? () => onSelect(address) : undefined,
      messages.selectedStatus,
    );
  }

  async function remove(address: SavedAddress) {
    if (!onDelete) return;
    setActionPending(true);
    try {
      await onDelete({ addressId: address.id, revision: address.revision });
      setConfirmDeleteId(undefined);
      setStatus(messages.deletedStatus);
    } catch {
      setStatus(messages.actionError);
    } finally {
      setActionPending(false);
    }
  }

  return (
    <main
      className={styles.surface}
      aria-busy={view === "pending" || actionPending}
    >
      <h1>{messages.heading}</h1>
      {view === "signed-out" ? (
        <div className={styles.signedOut}>
          <p>{messages.signedOut}</p>
          <Link href="/account/sign-in?returnTo=%2Faddresses">
            {messages.signIn}
          </Link>
        </div>
      ) : null}
      {retryAfterSeconds > 0 ? (
        <p className={styles.alert} role="alert">
          {messages.rateLimited}
        </p>
      ) : view === "conflict" ? (
        <p className={styles.alert} role="alert">
          {messages.conflict}
        </p>
      ) : null}
      {view === "error" && retryAfterSeconds <= 0 ? (
        <p className={styles.alert} role="alert">
          {messages.loadError}
        </p>
      ) : null}
      {(view === "conflict" || view === "error") && onRetry ? (
        <div className={styles.actions}>
          <button
            type="button"
            disabled={actionPending || retryAfterSeconds > 0}
            onClick={() => runAction(onRetry, messages.refreshed)}
          >
            {retryAfterSeconds > 0
              ? messages.refreshIn(retryAfterSeconds)
              : messages.refresh}
          </button>
        </div>
      ) : null}
      {view !== "signed-out" && view !== "pending" ? (
        <>
          {addresses.length ? (
            <ul className={styles.list}>
              {addresses.map((address) => (
                <li
                  className={styles.card}
                  data-selected={resolvedSelectedId === address.id}
                  key={address.id}
                >
                  <button
                    className={styles.addressOption}
                    type="button"
                    aria-pressed={resolvedSelectedId === address.id}
                    disabled={mutationsUnavailable}
                    onClick={() => setSelection({ sourceId: selectedId, draftId: address.id })}
                  >
                    <span>
                      <strong>{address.label ?? address.street ?? "Address"}</strong>
                      <span>{address.formattedLabel}</span>
                    </span>
                    <span className={styles.indicator} aria-hidden="true" />
                  </button>
                  {resolvedSelectedId === address.id ? (
                    <span className="sr-only">{messages.selected}</span>
                  ) : null}
                  {onEdit || onDelete ? (
                    <div className={styles.secondaryActions}>
                      {onEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(address)}
                          disabled={mutationsUnavailable}
                        >
                          {messages.edit}
                        </button>
                      ) : null}
                      {onDelete ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(address.id)}
                          disabled={mutationsUnavailable}
                        >
                          {messages.delete}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {resolvedConfirmDeleteId === address.id ? (
                    <div
                      className={styles.actions}
                      role="group"
                      aria-label={messages.deleteGroup(
                        address.label ?? address.formattedLabel,
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void remove(address)}
                        disabled={mutationsUnavailable}
                      >
                        {messages.confirmDelete}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(undefined)}
                        disabled={mutationsUnavailable}
                      >
                        {messages.cancel}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty} role="status">
              {messages.empty}
            </p>
          )}
          <button
            className={styles.addAction}
            type="button"
            onClick={onCreate}
            disabled={mutationsUnavailable || !onCreate}
          >
            {messages.add}
          </button>
          {nextCursor ? (
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() =>
                  runAction(
                    onLoadMore ? () => onLoadMore(nextCursor) : undefined,
                    messages.loadedMore,
                  )
                }
                disabled={mutationsUnavailable || !onLoadMore}
              >
                {messages.loadMore}
              </button>
            </div>
          ) : null}
          {draftSelectedAddress && showDeliveryAction ? (
            <div className={styles.primaryAction}>
              <Button
                type="button"
                onClick={() => void confirmSelection()}
                disabled={mutationsUnavailable || !onSelect || !policy}
                aria-describedby="saved-addresses-status"
              >
                {messages.deliverTo(
                  draftSelectedAddress.label ?? "this address",
                )}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <p
        className={styles.status}
        id="saved-addresses-status"
        role="status"
        aria-live="polite"
      >
        {view === "pending" ? messages.pending : status}
      </p>
    </main>
  );
}
