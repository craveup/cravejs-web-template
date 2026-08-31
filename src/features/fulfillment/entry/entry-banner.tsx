import Link from "next/link";

import { fulfillmentRoutes } from "../routes";
import type { EntryIntent } from "./resolve-entry-intent";
import styles from "./entry-banner.module.css";

export function EntryBanner({
  intent,
  locationId,
}: {
  intent: EntryIntent;
  locationId: string;
}) {
  if (intent.kind === "direct") return null;

  if (intent.kind === "table") {
    return (
      <div className={styles.banner} aria-label="Order context">
        <span>
          You scanned the code at <strong>Table {intent.detail.tableIdentifier}</strong> — we will
          bring it to you.
        </span>
        <Link
          href={`${fulfillmentRoutes.table(locationId)}?table=${encodeURIComponent(intent.detail.tableIdentifier ?? "")}`}
        >
          Change
        </Link>
      </div>
    );
  }

  if (intent.kind === "room") {
    return (
      <div className={styles.banner} aria-label="Order context">
        <span>
          Ordering for <strong>Room {intent.detail.roomIdentifier}</strong> — complete room details
          before checkout.
        </span>
        <Link
          href={`${fulfillmentRoutes.room(locationId)}?room=${encodeURIComponent(intent.detail.roomIdentifier ?? "")}`}
        >
          Complete
        </Link>
      </div>
    );
  }

  return (
    <div className={`${styles.banner} ${styles.invalid}`} role="alert">
      <span>
        <strong>We could not choose an order context.</strong> Use one table or room link.
      </span>
      <Link href={fulfillmentRoutes.store(locationId)}>Continue with pickup</Link>
    </div>
  );
}
