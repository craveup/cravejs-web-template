import type { CustomerAddress } from "@craveup/storefront-sdk";

import type { NormalizedAddress } from "@/features/fulfillment/types";

const fixtureNormalizedAddresses = {
  "fixture-address-home": {
    formattedLabel: "1 Example Street, Los Angeles, CA 90012",
    street: "1 Example Street",
    city: "Los Angeles",
    region: "CA",
    latitude: 34.0522,
    longitude: -118.2437,
    countryCode: "US",
    postcode: "90012",
  },
  "fixture-address-office": {
    formattedLabel: "2 Example Avenue, Los Angeles, CA 90013",
    street: "2 Example Avenue",
    streetOptional: "Suite 200",
    city: "Los Angeles",
    region: "CA",
    latitude: 34.0498,
    longitude: -118.2468,
    countryCode: "US",
    postcode: "90013",
  },
} as const satisfies Record<string, NormalizedAddress>;

export async function normalizeFixtureSavedAddress(
  address: CustomerAddress,
): Promise<NormalizedAddress> {
  const normalized = fixtureNormalizedAddresses[
    address.addressId as keyof typeof fixtureNormalizedAddresses
  ];
  if (
    !normalized ||
    normalized.latitude !== address.lat ||
    normalized.longitude !== address.lng
  ) {
    throw new Error("The fixture saved address cannot be normalized.");
  }
  return normalized;
}
