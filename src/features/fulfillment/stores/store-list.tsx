"use client";

import { LocateFixed } from "lucide-react";
import { useMemo, useState } from "react";

import { fulfillmentRoutes } from "../routes";
import { StoreCard, type StoreListItem } from "./store-card";
import {
  createDistanceCoordinator,
  sortStoresByDistance,
  type DistanceOutcome,
  type GetStoreDistance,
} from "./store-distance";
import styles from "./store-list.module.css";
import {
  useStoreDistance,
  type StoreDistanceRuntime,
} from "./use-store-distance";

export type { StoreListItem } from "./store-card";

export interface StoreListProps {
  readonly stores: readonly StoreListItem[];
  readonly distanceRuntime?: StoreDistanceRuntime;
  readonly getDistance?: GetStoreDistance;
}

type LocationStatus =
  | "idle"
  | "pending"
  | "denied"
  | "unavailable"
  | "ready";

function statusMessages(
  status: LocationStatus,
  distances: ReadonlyMap<string, DistanceOutcome>,
) {
  const messages: string[] = [];
  if (status === "pending") messages.push("Finding nearby stores…");
  if (status === "denied") {
    messages.push(
      "Location permission was not granted. You can still choose a store.",
    );
  }
  if (status === "unavailable") {
    messages.push(
      "Distance lookup is unavailable. You can still choose a store.",
    );
  }
  if ([...distances.values()].some((result) => result.status === "rate-limited")) {
    messages.push("Some distances are temporarily rate limited.");
  }
  if ([...distances.values()].some((result) => result.status === "unavailable")) {
    messages.push("Some distances could not be loaded.");
  }
  return messages;
}

function StoreMapPreview() {
  return (
    <div className={styles.mapPlaceholder} aria-hidden="true">
      <svg viewBox="0 0 398 180" preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.water} d="M88 -20 C63 42 71 111 48 205" />
        <path className={styles.road} d="M139 -18 L186 198" />
        <path className={styles.road} d="M-25 101 L435 132" />
        <path className={styles.road} d="M135 197 L428 -13" />
        <path className={styles.road} d="M236 -16 L424 169" />
        <path className={styles.road} d="M310 -21 L438 107" />
        <path className={styles.road} d="M-29 58 L439 93" />
        <g className={styles.buildings}>
          <path d="M147 4 L171 -4 L185 27 L160 36 Z" />
          <path d="M184 42 L218 25 L233 53 L199 71 Z" />
          <path d="M224 76 L252 61 L269 88 L240 105 Z" />
          <path d="M121 78 L139 70 L169 139 L150 148 Z" />
          <path d="M283 111 L337 78 L354 97 L298 132 Z" />
          <path d="M223 140 L301 94 L319 120 L241 168 Z" />
        </g>
        <path
          className={styles.park}
          d="M190 101 C187 83 199 73 218 72 L241 96 C247 110 239 120 218 124 C202 127 194 119 190 101 Z"
        />
        <path
          className={styles.pin}
          d="M287 75 C287 67 293 62 300 62 C308 62 313 67 313 75 C313 85 300 97 300 97 C300 97 287 85 287 75 Z"
        />
        <circle className={styles.pinCenter} cx="300" cy="75" r="4" />
      </svg>
    </div>
  );
}

function ScopedStoreList({
  stores,
  distanceRuntime,
  getDistance: injectedDistance,
}: StoreListProps) {
  const getDistance = useStoreDistance(distanceRuntime, injectedDistance);
  const [distances, setDistances] = useState<ReadonlyMap<string, DistanceOutcome>>(
    new Map(),
  );
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [query, setQuery] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState(
    stores.find((store) => (store.enabledModes?.length ?? 1) > 0)?.id,
  );
  const coordinator = useMemo(
    () => (getDistance ? createDistanceCoordinator(getDistance, 3) : undefined),
    [getDistance],
  );
  const sortedStores = sortStoresByDistance(stores, distances);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleStores = normalizedQuery
    ? sortedStores.filter((store) =>
        [store.name, store.addressLabel]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery)),
      )
    : sortedStores;
  const selectedStore =
    visibleStores.find(
      (store) =>
        store.id === selectedStoreId &&
        (store.enabledModes?.length ?? 1) > 0,
    ) ?? visibleStores.find((store) => (store.enabledModes?.length ?? 1) > 0);
  const messages = statusMessages(status, distances);

  function locate() {
    if (!coordinator || typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("pending");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const results = await coordinator(
          { latitude: coords.latitude, longitude: coords.longitude },
          stores,
        );
        setDistances(results);
        setStatus("ready");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false },
    );
  }

  return (
    <main className={styles.surface}>
      <div className={styles.intro}>
        <h1>Find a store</h1>
        <p>Pick where you want to order from.</p>
      </div>
      <label className={styles.search}>
        <span className={styles.searchLabel}>Find a store</span>
        <span className={styles.searchControl}>
          <input
            type="search"
            value={query}
            placeholder="Search by address or city"
            onChange={(event) => setQuery(event.target.value)}
          />
          {getDistance ? (
            <button
              type="button"
              aria-label="Use my current location"
              aria-busy={status === "pending"}
              onClick={locate}
              disabled={status === "pending"}
            >
              <LocateFixed aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </label>
      <StoreMapPreview />
      <div className={styles.status} role="status" aria-live="polite">
        {messages.map((message) => (
          <span key={message}>{message}</span>
        ))}
        {selectedStore ? (
          <span className="sr-only">{selectedStore.name} selected.</span>
        ) : null}
      </div>
      {visibleStores.length ? (
        <ul className={styles.list} aria-label="Store locations">
          {visibleStores.map((store) => (
            <StoreCard
              distance={distances.get(store.id)}
              selected={selectedStore?.id === store.id}
              store={store}
              key={store.id}
              onSelect={() => setSelectedStoreId(store.id)}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <h2>No stores found</h2>
          <p>
            {stores.length
              ? "Try another address or city."
              : "There are no stores available for online ordering."}
          </p>
        </div>
      )}
      {selectedStore ? (
        <div className={styles.primaryAction}>
          <a href={fulfillmentRoutes.store(selectedStore.id)}>
            Order from {selectedStore.name}
          </a>
        </div>
      ) : null}
    </main>
  );
}

function storeListScope({
  stores,
  distanceRuntime,
}: Pick<StoreListProps, "stores" | "distanceRuntime">): string {
  return JSON.stringify([
    distanceRuntime?.mode ?? "injected",
    distanceRuntime?.mode === "fixture"
      ? distanceRuntime.merchantSlug
      : undefined,
    stores.map((store) => [
      store.id,
      store.name,
      store.addressLabel,
      store.coordinates?.latitude,
      store.coordinates?.longitude,
      store.enabledModes,
    ]),
  ]);
}

export function StoreList(props: StoreListProps) {
  return <ScopedStoreList key={storeListScope(props)} {...props} />;
}
