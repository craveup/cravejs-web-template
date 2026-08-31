import * as cart from "./cart";
import * as catalog from "./catalog";
import * as customer from "./customer";
import * as location from "./location";
import * as merchant from "./merchant";
import * as orders from "./orders";
import * as receipts from "./receipts";
import * as referenceTime from "./reference-now";
import * as scenarios from "./scenarios";
import * as storefrontConfig from "./storefront-config";

/**
 * The serializable, SDK-shaped data boundary shared by both fixture profiles.
 * Namespace imports ensure a new export in an existing canonical data module is
 * included in fixture safety checks without maintaining a second export list.
 */
export const canonicalFixturePack = {
  cart: { ...cart },
  catalog: { ...catalog },
  customer: { ...customer },
  location: { ...location },
  merchant: { ...merchant },
  orders: { ...orders },
  receipts: { ...receipts },
  referenceTime: { ...referenceTime },
  scenarios: { ...scenarios },
  storefrontConfig: { ...storefrontConfig },
} as const;
