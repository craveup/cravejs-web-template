import type {
  StorefrontMerchantDirectory,
  StorefrontStoreDirectory,
} from "@/lib/storefront/store-directory";

import type { FulfillmentMode } from "../types";
import type { StoreListItem } from "./store-card";

export interface StorePickerData {
  readonly merchantName: string;
  readonly stores: readonly StoreListItem[];
}

const modeEntries = [
  ["pickup", "takeout"],
  ["delivery", "delivery"],
  ["table", "table-side"],
  ["roomService", "room-service"],
] as const satisfies ReadonlyArray<
  readonly [keyof StorefrontMerchantDirectory["locations"][number]["methodsStatus"], FulfillmentMode]
>;

export function toStorePickerData(
  merchant: StorefrontMerchantDirectory,
): StorePickerData {
  return {
    merchantName: merchant.name,
    stores: merchant.locations.map((location) => ({
      id: location.id,
      name: location.name,
      addressLabel: location.addressLabel,
      coordinates: location.coordinates,
      enabledModes: modeEntries
        .filter(([key]) => location.methodsStatus[key])
        .map(([, mode]) => mode),
    })),
  };
}

export async function loadStorePickerData(
  merchantSlug: string,
  directory: StorefrontStoreDirectory,
): Promise<StorePickerData | null> {
  const merchant = await directory.merchant.getBySlug(merchantSlug);
  return merchant ? toStorePickerData(merchant) : null;
}
