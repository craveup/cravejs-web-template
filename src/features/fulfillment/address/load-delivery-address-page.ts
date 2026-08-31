import "server-only";

import type { StorefrontLocation } from "@craveup/storefront-sdk";

import type { AccountPageRuntime } from "@/features/status/account-page";
import type { FixtureRuntime } from "@/fixtures/fixture-runtime";

import { loadFulfillmentLocation } from "../server/load-fulfillment-location";
import type { DeliveryAddressRuntime } from "./delivery-address-runtime";
import type { DeliveryPolicy } from "./serviceability";

const countryCodeByName = {
  "United States": "US",
  "United Arab Emirates": "AE",
  Australia: "AU",
  "United Kingdom": "GB",
} as const;

const templateDeliveryRadiusMiles = 5;

function deliveryRadiusMiles() {
  const configured = process.env.STOREFRONT_DELIVERY_RADIUS_MILES?.trim();
  if (!configured) return templateDeliveryRadiusMiles;
  const value = Number(configured);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("STOREFRONT_DELIVERY_RADIUS_MILES must be a positive number.");
  }
  return value;
}

function deliveryPolicy(location: StorefrontLocation): DeliveryPolicy | null {
  const latitude = location.addressData.lat;
  const longitude = location.addressData.lng;
  const country = location.addressData.country?.trim();
  const countryCode = country
    ? countryCodeByName[country as keyof typeof countryCodeByName]
    : undefined;
  if (
    !countryCode ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return {
    supportedCountryCodes: [countryCode],
    postcodeRequiredCountryCodes: [countryCode],
    deliveryRadiusMiles: deliveryRadiusMiles(),
    origin: { latitude, longitude },
    policyLabel: `${location.restaurantDisplayName} delivery area`,
  };
}

export async function loadDeliveryAddressPage(input: Readonly<{
  locationId: string;
  runtime: AccountPageRuntime;
  fixtureRuntime: FixtureRuntime | null;
}>): Promise<
  | Readonly<{
      brand: string;
      policy: DeliveryPolicy;
      runtime: DeliveryAddressRuntime;
    }>
  | null
> {
  const location = await loadFulfillmentLocation(
    input.locationId,
    input.fixtureRuntime,
  );
  if (!location) return null;
  if (location.restaurantSlug !== input.runtime.merchantSlug) return null;
  const policy = deliveryPolicy(location);
  if (!policy) return null;
  return {
    brand: location.restaurantDisplayName,
    policy,
    runtime: input.fixtureRuntime
      ? { mode: "fixture", runtime: input.fixtureRuntime }
      : { mode: "live", merchantSlug: input.runtime.merchantSlug },
  };
}
