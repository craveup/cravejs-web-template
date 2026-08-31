import type { StorefrontLongFormContent } from "@/content/storefront-long-form";

import {
  createStorefrontLongFormData,
  type StorefrontLongFormData,
} from "../content/storefront-long-form-data";
import type { CatalogSource } from "./catalog-source";
import { loadStoreHomeData } from "./load-store-home";

export async function loadStorefrontLongFormData(
  locationId: string,
  source: CatalogSource,
  content: StorefrontLongFormContent,
): Promise<StorefrontLongFormData> {
  const store = await loadStoreHomeData(locationId, source);
  return createStorefrontLongFormData(store, content);
}
