import type { OrderTimesResponse } from "@craveup/storefront-sdk";

import type { OrderTimeDay } from "./order-time-picker";

export interface OrderTimeView {
  days: readonly OrderTimeDay[];
  allowAsap: boolean;
  scheduleAllowed: boolean;
  requireScheduledOrders: boolean;
}

export interface OrderTimeFormatOptions {
  locale: string;
  timeZone: string;
}

function formatter(
  { locale, timeZone }: OrderTimeFormatOptions,
  includeZone: boolean,
) {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    ...(includeZone ? { timeZoneName: "short" } : {}),
  });
}

export function toOrderTimeView(
  response: OrderTimesResponse,
  options: OrderTimeFormatOptions,
): OrderTimeView {
  const basicFormatter = formatter(options, false);
  const zonedFormatter = formatter(options, true);
  const wireFormatter = new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: options.timeZone,
  });
  const days = response.orderDays.map((day) => {
    const instants = day.intervals.map((instant) => {
      const value = new Date(instant);
      if (Number.isNaN(value.valueOf())) {
        throw new RangeError(`Invalid order-time instant for ${day.value}.`);
      }
      return { instant, value, label: basicFormatter.format(value) };
    });
    const labelCounts = new Map<string, number>();
    for (const instant of instants) {
      labelCounts.set(instant.label, (labelCounts.get(instant.label) ?? 0) + 1);
    }

    return {
      date: day.value,
      label: day.label,
      slots: instants.map(({ instant, label, value }) => ({
        instant,
        orderDate: day.value,
        orderTime: wireFormatter.format(value),
        label: (labelCounts.get(label) ?? 0) > 1 ? zonedFormatter.format(value) : label,
      })),
    };
  });

  return {
    days,
    allowAsap: !response.requireScheduledOrders,
    scheduleAllowed: response.scheduleAllowed,
    requireScheduledOrders: response.requireScheduledOrders ?? false,
  };
}
