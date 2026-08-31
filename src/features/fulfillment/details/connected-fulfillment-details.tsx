"use client";

import { useRef } from "react";

import { StorefrontFulfillmentActionError } from "@/lib/storefront/fulfillment-actions";

import {
  setRoomFulfillmentDetails,
  setTableFulfillmentDetails,
  type FulfillmentDetailsRuntime,
} from "./fulfillment-details-runtime";
import { RoomForm, type RoomSubmission } from "./room-form";
import { TableConfirmation } from "./table-confirmation";

interface MutationAttempt {
  readonly signature: string;
  readonly idempotencyKey: string;
}

function conflictError(message: string) {
  return new StorefrontFulfillmentActionError({
    state: "cart-conflict",
    code: "CART_CONFLICT",
    message,
  });
}

export function ConnectedTableConfirmation({
  initialTableIdentifier,
  locationId,
  locationLabel,
  runtime,
}: {
  readonly initialTableIdentifier?: string;
  readonly locationId: string;
  readonly locationLabel?: string;
  readonly runtime: FulfillmentDetailsRuntime;
}) {
  const attempt = useRef<MutationAttempt | undefined>(undefined);
  return (
    <TableConfirmation
      initialTableIdentifier={initialTableIdentifier}
      locationLabel={locationLabel}
      onSubmit={async (tableNumber) => {
        const signature = JSON.stringify({ tableNumber });
        if (attempt.current?.signature !== signature) {
          attempt.current = {
            signature,
            idempotencyKey: globalThis.crypto.randomUUID(),
          };
        }
        const result = await setTableFulfillmentDetails(
          runtime,
          locationId,
          tableNumber,
          attempt.current.idempotencyKey,
        );
        attempt.current = undefined;
        if (result.state === "retry-required") {
          throw conflictError(result.error.message);
        }
        return result.cart;
      }}
    />
  );
}

export function ConnectedRoomForm({
  initialRoomIdentifier,
  locationId,
  runtime,
}: {
  readonly initialRoomIdentifier?: string;
  readonly locationId: string;
  readonly runtime: FulfillmentDetailsRuntime;
}) {
  const attempt = useRef<MutationAttempt | undefined>(undefined);
  return (
    <RoomForm
      initialRoomIdentifier={initialRoomIdentifier}
      onSubmit={async (detail: RoomSubmission) => {
        const signature = JSON.stringify(detail);
        if (attempt.current?.signature !== signature) {
          attempt.current = {
            signature,
            idempotencyKey: globalThis.crypto.randomUUID(),
          };
        }
        const result = await setRoomFulfillmentDetails(
          runtime,
          locationId,
          detail,
          attempt.current.idempotencyKey,
        );
        attempt.current = undefined;
        if (result.state === "retry-required") {
          throw conflictError(result.error.message);
        }
        return result.cart;
      }}
    />
  );
}
