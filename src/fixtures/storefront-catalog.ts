import {
  fixtureMenuBundle,
  fixtureProductsById,
} from "./catalog";
import { fixtureLocation } from "./location";
import {
  mapStorefrontLocation,
  mapStorefrontMenuBundle,
  mapStorefrontProduct,
  type StorefrontCatalogReader,
} from "@/lib/storefront/catalog";

const fixtureMenu = mapStorefrontMenuBundle(fixtureMenuBundle);
const fixtureProducts = new Map(
  Object.values(fixtureProductsById).map((product) => [product.id, product]),
);

export const fixtureStorefrontCatalogReader: StorefrontCatalogReader = {
  locations: {
    async getById(locationId) {
      return locationId === fixtureLocation.id
        ? structuredClone(mapStorefrontLocation(fixtureLocation))
        : null;
    },
  },
  menus: {
    async list(locationId) {
      return locationId === fixtureLocation.id
        ? structuredClone(fixtureMenu)
        : { menus: [], popularProducts: [] };
    },
  },
  products: {
    async get(locationId, productId) {
      if (locationId !== fixtureLocation.id) return null;
      const product = fixtureProducts.get(productId);
      return product ? structuredClone(mapStorefrontProduct(product)) : null;
    },
  },
};
