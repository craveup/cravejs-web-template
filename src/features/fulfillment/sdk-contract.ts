import type {
  DeliveryAddress,
  FulfilmentMethod,
  StartOrderingSessionRequest,
  SupportedCountry,
} from "@craveup/storefront-sdk";

import {
  fulfillmentModeWireValues,
  hasValidCoordinates,
  type FulfillmentMode,
  type NormalizedAddress,
} from "./types";

const supportedCountriesByCode = {
  US: "United States",
  AE: "United Arab Emirates",
  AU: "Australia",
  GB: "United Kingdom",
} as const satisfies Record<string, SupportedCountry>;

export interface OrderingSessionIntent {
  mode: FulfillmentMode;
  existingCartId?: string | null;
  channel?: StartOrderingSessionRequest["channel"];
  returnUrl?: string;
}

export type DeliveryAddressConversion =
  | { ready: true; address: DeliveryAddress }
  | {
      ready: false;
      reason: "incomplete" | "unsupported-country" | "invalid-coordinates";
    };

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

export function toSdkFulfilmentMethod(mode: FulfillmentMode): FulfilmentMethod {
  return fulfillmentModeWireValues[mode];
}

export function toStartOrderingSessionRequest(
  intent: OrderingSessionIntent,
): StartOrderingSessionRequest {
  return {
    fulfillmentMethod: toSdkFulfilmentMethod(intent.mode),
    ...(intent.existingCartId !== undefined
      ? { existingCartId: intent.existingCartId }
      : {}),
    ...(intent.channel ? { channel: intent.channel } : {}),
    ...(intent.returnUrl ? { returnUrl: intent.returnUrl } : {}),
  };
}

export function toSdkDeliveryAddress(
  address: NormalizedAddress,
): DeliveryAddressConversion {
  const street = address.street?.trim();
  const city = address.city?.trim();
  const region = address.region?.trim();
  const postcode = address.postcode?.trim();
  if (!hasValidCoordinates(address)) {
    return { ready: false, reason: "invalid-coordinates" };
  }

  if (
    !street ||
    !city ||
    !region ||
    !postcode ||
    !present(address.formattedLabel)
  ) {
    return { ready: false, reason: "incomplete" };
  }

  const country = supportedCountriesByCode[
    address.countryCode.trim().toUpperCase() as keyof typeof supportedCountriesByCode
  ];
  if (!country) return { ready: false, reason: "unsupported-country" };

  return {
    ready: true,
    address: {
      street,
      ...(present(address.streetOptional)
        ? { streetOptional: address.streetOptional!.trim() }
        : {}),
      city,
      state: region,
      zipCode: postcode,
      country,
      lat: address.latitude,
      lng: address.longitude,
    },
  };
}
