import type { DistanceResponse } from "@craveup/storefront-sdk";

import { createStorefrontStoreDirectory } from "@/lib/storefront/store-directory";

import type { FixtureRuntime } from "./fixture-runtime";
import { FixtureRuntimeError } from "./fixture-runtime";
import { fixtureMerchant } from "./merchant";

const earthRadiusMiles = 3_958.8;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMiles(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

export function createFixtureStoreDirectory(runtime: FixtureRuntime) {
  return createFixtureStoreDirectoryForScope({
    merchantSlug: runtime.config.merchantSlug,
    networkPolicy: runtime.networkPolicy,
  });
}

export function createFixtureStoreDirectoryForScope(scope: {
  readonly merchantSlug: string;
  readonly networkPolicy: "deny";
}) {
  if (scope.networkPolicy !== "deny") {
    throw new FixtureRuntimeError(
      "The fixture store directory requires the deny-network policy.",
    );
  }

  return createStorefrontStoreDirectory({
    merchant: {
      async getBySlug(slug) {
        if (slug !== scope.merchantSlug) {
          throw new FixtureRuntimeError("Unknown fixture merchant.");
        }
        return fixtureMerchant;
      },
    },
    locations: {
      async distance(locationId, payload): Promise<DistanceResponse> {
        const location = fixtureMerchant.locations.find(
          ({ id }) => id === locationId,
        );
        if (!location || location.lat === null || location.lng === null) {
          throw new FixtureRuntimeError("Unknown fixture location.");
        }
        const miles = distanceMiles(
          { latitude: payload.lat, longitude: payload.lng },
          { latitude: location.lat, longitude: location.lng },
        );
        return {
          locationId,
          location: {
            id: location.id,
            restaurantDisplayName: location.restaurantDisplayName,
            addressString: location.addressString,
            coordinates: { lat: location.lat, lng: location.lng },
          },
          distance: {
            value: miles,
            unit: "miles",
            miles,
            kilometers: miles * 1.609344,
          },
        };
      },
    },
  });
}
