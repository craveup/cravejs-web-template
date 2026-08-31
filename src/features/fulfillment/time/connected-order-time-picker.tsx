"use client";

import type { OrderTimeDay, OrderTimeState } from "./order-time-picker";
import { OrderTimePicker, type OrderTimeSelection } from "./order-time-picker";
import { updateOrderTime, type OrderTimeRuntime } from "./order-time-runtime";

export function ConnectedOrderTimePicker({
  allowAsap,
  days,
  initialState,
  locationId,
  readinessReason,
  runtime,
}: {
  readonly allowAsap: boolean;
  readonly days: readonly OrderTimeDay[];
  readonly initialState: OrderTimeState;
  readonly locationId: string;
  readonly readinessReason?: string;
  readonly runtime: OrderTimeRuntime;
}) {
  return (
    <OrderTimePicker
      allowAsap={allowAsap}
      days={days}
      state={initialState}
      closedReason={readinessReason}
      onSelect={async (selection: OrderTimeSelection) => {
        const result = await updateOrderTime(
          runtime,
          locationId,
          selection === "asap"
            ? { pickupType: "ASAP" }
            : {
                pickupType: "LATER",
                orderDate: selection.orderDate,
                orderTime: selection.orderTime,
              },
        );
        return result;
      }}
      onRetry={() => undefined}
    />
  );
}
