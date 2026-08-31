import type {
  DistanceRequest,
  DistanceResponse,
  MerchantApiResponse,
} from "@craveup/storefront-sdk";

import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";

export interface StorefrontCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface StorefrontDirectoryLocation {
  readonly id: string;
  readonly name: string;
  readonly addressLabel?: string;
  readonly coordinates?: StorefrontCoordinates;
  readonly methodsStatus: Readonly<{
    pickup: boolean;
    table: boolean;
    delivery: boolean;
    roomService: boolean;
  }>;
}

export interface StorefrontMerchantDirectory {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly logoImageUrl?: string;
  readonly coverImageUrl?: string;
  readonly locations: readonly StorefrontDirectoryLocation[];
}

export interface StorefrontStoreDirectory {
  readonly merchant: {
    getBySlug(slug: string): Promise<StorefrontMerchantDirectory | null>;
  };
  readonly locations: {
    distance(
      locationId: string,
      origin: StorefrontCoordinates,
    ): Promise<{ readonly miles: number }>;
  };
}

interface StorefrontStoreDirectoryClient {
  readonly merchant: {
    getBySlug(slug: string): Promise<MerchantApiResponse>;
  };
  readonly locations: {
    distance(
      locationId: string,
      payload: DistanceRequest,
    ): Promise<DistanceResponse>;
  };
}

export class StorefrontStoreDirectoryError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly requestId?: string;
  readonly retryAfterMs?: number;

  constructor(error: StorefrontErrorState) {
    super(error.message);
    this.name = "StorefrontStoreDirectoryError";
    this.state = error.state;
    this.code = error.code;
    this.requestId = error.requestId;
    this.retryAfterMs = error.retryAfterMs;
  }
}

function validCoordinates(
  latitude: number | null,
  longitude: number | null,
): StorefrontCoordinates | undefined {
  return latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
    ? { latitude, longitude }
    : undefined;
}

function mapMerchant(
  merchant: MerchantApiResponse,
): StorefrontMerchantDirectory {
  return {
    id: merchant.id,
    name: merchant.name,
    description: merchant.bio,
    ...(merchant.logo ? { logoImageUrl: merchant.logo } : {}),
    ...(merchant.cover ? { coverImageUrl: merchant.cover } : {}),
    locations: merchant.locations.map((location) => {
      const coordinates = validCoordinates(location.lat, location.lng);
      return {
        id: location.id,
        name: location.restaurantDisplayName,
        ...(location.addressString
          ? { addressLabel: location.addressString }
          : {}),
        ...(coordinates ? { coordinates } : {}),
        methodsStatus: { ...location.methodsStatus },
      };
    }),
  };
}

function toDirectoryError(error: unknown): StorefrontStoreDirectoryError {
  return error instanceof StorefrontStoreDirectoryError
    ? error
    : new StorefrontStoreDirectoryError(toStorefrontErrorState(error));
}

export function createStorefrontStoreDirectory(
  client: StorefrontStoreDirectoryClient,
): StorefrontStoreDirectory {
  return {
    merchant: {
      async getBySlug(slug) {
        try {
          return mapMerchant(await client.merchant.getBySlug(slug));
        } catch (error) {
          const safeError = toDirectoryError(error);
          if (safeError.code === "NOT_FOUND") return null;
          throw safeError;
        }
      },
    },
    locations: {
      async distance(locationId, origin) {
        try {
          const response = await client.locations.distance(locationId, {
            lat: origin.latitude,
            lng: origin.longitude,
            unit: "miles",
          });
          return { miles: response.distance.miles };
        } catch (error) {
          throw toDirectoryError(error);
        }
      },
    },
  };
}
