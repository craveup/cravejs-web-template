"use client";

import { useMemo } from "react";

import {
  createStoreDirectoryDistancePort,
  type GetStoreDistance,
} from "./store-distance";

export type StoreDistanceRuntime =
  | { readonly mode: "live" }
  | {
      readonly mode: "fixture";
      readonly merchantSlug: string;
      readonly networkPolicy: "deny";
    };

async function loadDistancePort(
  runtime: StoreDistanceRuntime,
): Promise<GetStoreDistance> {
  if (runtime.mode === "fixture") {
    const { createFixtureStoreDirectoryForScope } = await import(
      "@/fixtures/store-directory"
    );
    const directory = createFixtureStoreDirectoryForScope(runtime);
    return createStoreDirectoryDistancePort(directory.locations.distance);
  }

  const { browserStoreDirectory } = await import(
    "@/lib/storefront/browser-store-directory"
  );
  return createStoreDirectoryDistancePort(
    browserStoreDirectory.locations.distance,
  );
}

export function useStoreDistance(
  runtime: StoreDistanceRuntime | undefined,
  injectedDistance?: GetStoreDistance,
): GetStoreDistance | undefined {
  return useMemo(() => {
    if (injectedDistance) return injectedDistance;
    if (!runtime) return undefined;

    let port: Promise<GetStoreDistance> | undefined;
    return (locationId, origin) => {
      port ??= loadDistancePort(runtime);
      return port.then((getDistance) => getDistance(locationId, origin));
    };
  }, [injectedDistance, runtime]);
}
