import {
  StorefrontStoreDirectoryError,
  type StorefrontStoreDirectory,
} from "@/lib/storefront/store-directory";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface StoreDistanceTarget {
  id: string;
}

export type DistanceOutcome =
  | { status: "available"; miles: number }
  | { status: "unavailable" }
  | { status: "rate-limited" };

export type GetStoreDistance = (
  locationId: string,
  origin: Coordinates,
) => Promise<DistanceOutcome>;

export type ReadStorefrontDistance =
  StorefrontStoreDirectory["locations"]["distance"];

const coordinateKey = ({ latitude, longitude }: Coordinates) => `${latitude},${longitude}`;

export function createDistanceCoordinator(getDistance: GetStoreDistance, concurrency = 3) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Distance concurrency must be a positive integer.");
  }
  const cache = new Map<string, Promise<DistanceOutcome>>();

  return async function loadDistances(origin: Coordinates, targets: readonly StoreDistanceTarget[]) {
    const results = new Map<string, DistanceOutcome>();
    let cursor = 0;

    async function worker() {
      while (cursor < targets.length) {
        const target = targets[cursor++];
        const key = `${coordinateKey(origin)}:${target.id}`;
        const request = cache.get(key) ?? getDistance(target.id, origin);
        cache.set(key, request);
        try {
          const outcome = await request;
          if (outcome.status !== "available") cache.delete(key);
          results.set(target.id, outcome);
        } catch {
          cache.delete(key);
          results.set(target.id, { status: "unavailable" });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()),
    );
    return results;
  };
}

export function createStoreDirectoryDistancePort(
  readDistance: ReadStorefrontDistance,
): GetStoreDistance {
  return async (locationId, origin) => {
    try {
      const { miles } = await readDistance(locationId, origin);
      return Number.isFinite(miles) && miles >= 0
        ? { status: "available", miles }
        : { status: "unavailable" };
    } catch (error) {
      if (
        error instanceof StorefrontStoreDirectoryError &&
        error.state === "rate-limited"
      ) {
        return { status: "rate-limited" };
      }
      throw error;
    }
  };
}

export function sortStoresByDistance<T extends { id: string }>(
  stores: readonly T[],
  distances: ReadonlyMap<string, DistanceOutcome>,
) {
  return stores
    .map((store, index) => ({ store, index, result: distances.get(store.id) }))
    .sort((left, right) => {
      const leftMiles = left.result?.status === "available" ? left.result.miles : Infinity;
      const rightMiles = right.result?.status === "available" ? right.result.miles : Infinity;
      return leftMiles - rightMiles || left.index - right.index;
    })
    .map(({ store }) => store);
}
