"use client";

import type { CustomerAddress } from "@craveup/storefront-sdk";
import { useMemo } from "react";

import { createGooglePlacesAddressAdapter } from "./google-places";
import {
  applySavedAddressToDelivery,
  SavedAddressSelectionError,
} from "./saved-address-delivery";
import { SavedAddressesScreen } from "./saved-addresses-screen";
import type { DeliveryAddressRuntime } from "./delivery-address-runtime";
import type { DeliveryPolicy } from "./serviceability";

export function ConnectedSavedAddressesScreen({
  googleMapsApiKey,
  locationId,
  locale,
  merchantSlug,
  mode,
  policy,
  runtime,
}: {
  readonly googleMapsApiKey?: string;
  readonly locationId: string;
  readonly locale: string;
  readonly merchantSlug: string;
  readonly mode: "fixture" | "live";
  readonly policy: DeliveryPolicy;
  readonly runtime: DeliveryAddressRuntime;
}) {
  const places = useMemo(
    () =>
      mode === "live" && googleMapsApiKey
        ? createGooglePlacesAddressAdapter(
            googleMapsApiKey,
            policy.supportedCountryCodes,
          )
        : undefined,
    [googleMapsApiKey, mode, policy.supportedCountryCodes],
  );

  async function normalize(address: CustomerAddress) {
    if (mode === "fixture") {
      const { normalizeFixtureSavedAddress } = await import(
        "@/fixtures/saved-address-normalizer"
      );
      return normalizeFixtureSavedAddress(address);
    }
    if (!places) {
      throw new SavedAddressSelectionError(
        "Saved-address verification is unavailable. Choose a new delivery address.",
      );
    }
    return places.reverse({ latitude: address.lat, longitude: address.lng });
  }

  return (
    <SavedAddressesScreen
      merchantSlug={merchantSlug}
      locale={locale}
      mode={mode}
      policy={policy}
      onApplyAddress={async (address) => {
        await applySavedAddressToDelivery({
          address,
          locationId,
          policy,
          runtime,
          normalize,
        });
      }}
    />
  );
}
