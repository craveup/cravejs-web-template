import "server-only";

import type {
  OrderTimesResponse,
  OrderingReadinessResponse,
} from "@craveup/storefront-sdk";

import { fixtureCalendar } from "@/fixtures/reference-now";

import { toOrderTimeView, type OrderTimeView } from "./order-time-contract";

export interface LoadedOrderTimes extends OrderTimeView {
  readonly state: "ready" | "closed";
  readonly readinessReason?: string;
}

const fixtureOrderTimes = {
  orderDays: [
    {
      value: fixtureCalendar.cartOrderDate,
      label: "Today",
      intervals: [
        "2026-08-10T18:30:00.000Z",
        "2026-08-10T18:45:00.000Z",
        "2026-08-10T19:00:00.000Z",
        "2026-08-10T19:15:00.000Z",
      ],
    },
    {
      value: "2026-08-11",
      label: "Tomorrow",
      intervals: ["2026-08-11T18:30:00.000Z"],
    },
  ],
  scheduleAllowed: true,
} satisfies OrderTimesResponse;

export async function loadOrderTimes(input: {
  readonly locationId: string;
  readonly locale: string;
  readonly timeZone: string;
  readonly mode: "fixture" | "live";
  readonly forceClosed?: boolean;
}): Promise<LoadedOrderTimes> {
  let times: OrderTimesResponse;
  let readiness: OrderingReadinessResponse;

  if (input.mode === "fixture") {
    times = fixtureOrderTimes;
    readiness = input.forceClosed
      ? { ready: false, fulfillmentMethod: "takeout", reason: "Closed right now" }
      : {
          ready: true,
          fulfillmentMethod: "takeout",
          pickupType: "ASAP",
          orderDate: fixtureCalendar.cartOrderDate,
          orderTime: "11:30",
          estimatedReadyTime: "12–22 minutes",
        };
  } else {
    const { storefrontServerClient } = await import(
      "@/lib/storefront/server-client"
    );
    [times, readiness] = await Promise.all([
      storefrontServerClient.locations.getOrderTimes(input.locationId),
      storefrontServerClient.locations.getOrderingReadiness(
        input.locationId,
        "takeout",
      ),
    ]);
  }

  return {
    ...toOrderTimeView(times, {
      locale: input.locale,
      timeZone: input.timeZone,
    }),
    state: readiness.ready ? "ready" : "closed",
    ...(!readiness.ready ? { readinessReason: readiness.reason } : {}),
  };
}
