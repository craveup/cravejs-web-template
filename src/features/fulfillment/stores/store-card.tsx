import {
  fulfillmentModeLabels,
  type FulfillmentMode,
} from "../types";
import type { DistanceOutcome } from "./store-distance";
import styles from "./store-list.module.css";

export interface StoreListItem {
  readonly id: string;
  readonly name: string;
  readonly addressLabel?: string;
  readonly coordinates?: Readonly<{
    latitude: number;
    longitude: number;
  }>;
  readonly enabledModes?: readonly FulfillmentMode[];
}

export function StoreCard({
  distance,
  selected,
  store,
  onSelect,
}: {
  readonly distance?: DistanceOutcome;
  readonly selected: boolean;
  readonly store: StoreListItem;
  readonly onSelect: () => void;
}) {
  const enabledModes = store.enabledModes ?? [];
  const orderable = enabledModes.length > 0 || store.enabledModes === undefined;

  return (
    <li className={styles.card} data-selected={selected}>
      <button
        type="button"
        aria-label={`Select ${store.name}`}
        aria-pressed={selected}
        disabled={!orderable}
        onClick={onSelect}
      >
        <span className={styles.cardCopy}>
          <span className={styles.storeHeading}>
            <span className={styles.storeName} role="heading" aria-level={2}>
              {store.name}
            </span>
          </span>
          <span className={styles.storeDetails}>
            {store.addressLabel ? (
              <span className={styles.meta}>{store.addressLabel}</span>
            ) : null}
            {distance?.status === "available" ? (
              <span className={styles.distance}>
                {distance.miles.toFixed(1)} mi away
              </span>
            ) : null}
          </span>
          {enabledModes.length ? (
            <span
              className={styles.modeList}
              aria-label="Available fulfillment methods"
            >
              {enabledModes.map((mode) => (
                <span className={styles.mode} key={mode}>
                  {fulfillmentModeLabels[mode]}
                </span>
              ))}
            </span>
          ) : store.enabledModes ? (
            <span className={styles.unavailable}>Ordering unavailable</span>
          ) : null}
        </span>
        <span className={styles.selection} aria-hidden="true" />
      </button>
    </li>
  );
}
