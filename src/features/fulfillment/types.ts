import type { FulfilmentMethod } from "@craveup/storefront-sdk";

export const fulfillmentModes = [
  "takeout",
  "delivery",
  "table-side",
  "room-service",
] as const;

export type FulfillmentMode = (typeof fulfillmentModes)[number];

export const fulfillmentModeLabels: Record<FulfillmentMode, string> = {
  takeout: "Pickup",
  delivery: "Delivery",
  "table-side": "Table service",
  "room-service": "Room service",
};

export const fulfillmentModeWireValues = {
  takeout: "takeout",
  delivery: "delivery",
  "table-side": "table_side",
  "room-service": "room_service",
} as const satisfies Record<FulfillmentMode, FulfilmentMethod>;

export interface NormalizedAddress {
  formattedLabel: string;
  street?: string;
  streetOptional?: string;
  city?: string;
  region?: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  postcode?: string;
}

export function hasValidCoordinates(value: { latitude: number; longitude: number }) {
  return (
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

export type FulfillmentDetail =
  | { mode: "takeout" }
  | { mode: "delivery"; address?: NormalizedAddress }
  | { mode: "table-side"; tableIdentifier?: string }
  | { mode: "room-service"; roomIdentifier?: string; lastName?: string };

export interface FulfillmentDescription {
  modeLabel: string;
  summary: string;
  complete: boolean;
  changeHref: string;
}
