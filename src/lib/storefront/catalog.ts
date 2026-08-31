import type {
  MenuBundle,
  MenuProduct,
  Modifier,
  ModifierChildLink,
  Product,
  StorefrontLocation,
} from "@craveup/storefront-sdk";

import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";

export type StorefrontCurrency = "usd" | "gbp" | "aed" | "aud";

export interface StorefrontCatalogLocation {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly coverImageUrl: string;
  readonly logoImageUrl: string;
  readonly addressLabel: string;
  readonly address: Readonly<{
    street?: string;
    streetOptional?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    lat?: number | null;
    lng?: number | null;
  }>;
}

export interface StorefrontCatalogProductSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: string;
  readonly displayPrice: string;
  readonly currency: StorefrontCurrency;
  readonly availability?: string;
  readonly images: readonly string[];
  readonly modifierGroupIds: readonly string[];
}

export interface StorefrontCatalogCategory {
  readonly id: string;
  readonly name: string;
  readonly products: readonly StorefrontCatalogProductSummary[];
}

export interface StorefrontCatalogMenu {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly hoursLabel: string;
  readonly imageUrl?: string;
  readonly categories: readonly StorefrontCatalogCategory[];
}

export interface StorefrontCatalogMenuBundle {
  readonly menus: readonly StorefrontCatalogMenu[];
  readonly popularProducts: readonly StorefrontCatalogProductSummary[];
}

export interface StorefrontModifierGroupLink {
  readonly modifierGroupId: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly applyPerParentQuantity?: boolean;
  readonly circular?: boolean;
  readonly group?: StorefrontModifierGroup | null;
}

export interface StorefrontModifierOption {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly maximumQuantity: number;
  readonly childGroups?: readonly StorefrontModifierGroupLink[];
}

export interface StorefrontModifierGroup {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly imageUrl?: string;
  readonly rule: Readonly<{ minimum: number; maximum: number }>;
  readonly items: readonly StorefrontModifierOption[];
}

export interface StorefrontProductDetail {
  readonly id: string;
  readonly locationId: string;
  readonly name: string;
  readonly description: string;
  readonly availability: string;
  readonly images: readonly string[];
  readonly price: string;
  readonly displayPrice: string;
  readonly currency: StorefrontCurrency;
  readonly rootModifierGroupIds: readonly string[];
  readonly modifierGroups: readonly StorefrontModifierGroup[];
  readonly nutrition?: Readonly<{
    calorieCount?: number | null;
    dietaryPreferences?: readonly string[];
    ingredients?: readonly string[];
  }>;
}

export interface StorefrontCatalogReader {
  readonly locations: {
    getById(locationId: string): Promise<StorefrontCatalogLocation | null>;
  };
  readonly menus: {
    list(
      locationId: string,
      options: { readonly menuOnly: true },
    ): Promise<StorefrontCatalogMenuBundle>;
  };
  readonly products: {
    get(
      locationId: string,
      productId: string,
    ): Promise<StorefrontProductDetail | null>;
  };
}

interface StorefrontCatalogClient {
  readonly locations: {
    getById(locationId: string): Promise<StorefrontLocation>;
  };
  readonly menus: {
    list(
      locationId: string,
      options: { readonly menuOnly: true },
    ): Promise<MenuBundle>;
  };
  readonly products: {
    get(locationId: string, productId: string): Promise<Product>;
  };
}

export class StorefrontCatalogReadError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly requestId?: string;
  readonly details?: StorefrontErrorState["details"];
  readonly retryAfterMs?: number;
  readonly method?: string;
  readonly routeTemplate?: string;

  constructor(error: StorefrontErrorState) {
    super(error.message);
    this.name = "StorefrontCatalogReadError";
    this.state = error.state;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
    this.retryAfterMs = error.retryAfterMs;
    this.method = error.method;
    this.routeTemplate = error.routeTemplate;
  }
}

export function mapStorefrontLocation(
  location: StorefrontLocation,
): StorefrontCatalogLocation {
  return {
    id: location.id,
    slug: location.restaurantSlug,
    name: location.restaurantDisplayName,
    description: location.restaurantBio,
    coverImageUrl: location.coverPhoto,
    logoImageUrl: location.restaurantLogo,
    addressLabel: location.addressString,
    address: { ...location.addressData },
  };
}

function mapProductSummary(
  product: MenuProduct,
): StorefrontCatalogProductSummary {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    displayPrice: product.displayPrice,
    currency: product.currency,
    availability: product.availability,
    images: [...(product.images ?? [])],
    modifierGroupIds: [...product.modifierIds],
  };
}

export function mapStorefrontMenuBundle(
  bundle: MenuBundle,
): StorefrontCatalogMenuBundle {
  return {
    menus: bundle.menus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      active: menu.isActive,
      hoursLabel: menu.time,
      imageUrl: menu.imageUrl,
      categories: menu.categories.map((category) => ({
        id: category.id,
        name: category.name,
        products: category.products.map(mapProductSummary),
      })),
    })),
    popularProducts: bundle.popularProducts.map(mapProductSummary),
  };
}

function mapModifierLink(
  link: ModifierChildLink,
  ancestors: ReadonlySet<string>,
): StorefrontModifierGroupLink {
  return {
    modifierGroupId: link.groupId,
    minimum: link.overrides?.min,
    maximum: link.overrides?.max,
    applyPerParentQuantity: link.applyPerParentQuantity,
    circular: link.circular,
    group:
      link.group && !link.circular
        ? mapModifierGroup(link.group, ancestors)
        : undefined,
  };
}

function mapModifierGroup(
  group: Modifier,
  ancestors: ReadonlySet<string> = new Set(),
): StorefrontModifierGroup {
  if (ancestors.has(group.id)) {
    throw new StorefrontCatalogReadError({
      state: "integration-error",
      code: "INVALID_PRODUCT_GRAPH",
      message: "The item customization data is invalid.",
    });
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(group.id);
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    imageUrl: group.imageUrl,
    rule: {
      minimum: group.rule.min,
      maximum: group.rule.max,
    },
    items: group.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      maximumQuantity: item.maxQuantity,
      childGroups: item.childGroups?.map((link) =>
        mapModifierLink(link, nextAncestors),
      ),
    })),
  };
}

export function mapStorefrontProduct(
  product: Product,
): StorefrontProductDetail {
  return {
    id: product.id,
    locationId: product.locationId,
    name: product.name,
    description: product.description,
    availability: product.availability,
    images: [...product.images],
    price: product.price,
    displayPrice: product.displayPrice,
    currency: product.currency,
    rootModifierGroupIds: [...product.modifierIds],
    modifierGroups: product.modifiers.map((group) => mapModifierGroup(group)),
    nutrition: product.nutrition
      ? {
          calorieCount: product.nutrition.calorieCount,
          dietaryPreferences: [...(product.nutrition.dietaryPreferences ?? [])],
          ingredients: [...(product.nutrition.ingredients ?? [])],
        }
      : undefined,
  };
}

function toReadError(error: unknown): StorefrontCatalogReadError {
  return error instanceof StorefrontCatalogReadError
    ? error
    : new StorefrontCatalogReadError(toStorefrontErrorState(error));
}

async function readNullable<TInput, TOutput>(
  read: () => Promise<TInput>,
  map: (value: TInput) => TOutput,
): Promise<TOutput | null> {
  try {
    return map(await read());
  } catch (error) {
    const safeError = toReadError(error);
    if (safeError.code === "NOT_FOUND") return null;
    throw safeError;
  }
}

export function createStorefrontCatalogReader(
  client: StorefrontCatalogClient,
): StorefrontCatalogReader {
  return {
    locations: {
      getById: (locationId) =>
        readNullable(
          () => client.locations.getById(locationId),
          mapStorefrontLocation,
        ),
    },
    menus: {
      async list(locationId, options) {
        try {
          return mapStorefrontMenuBundle(
            await client.menus.list(locationId, options),
          );
        } catch (error) {
          throw toReadError(error);
        }
      },
    },
    products: {
      get: (locationId, productId) =>
        readNullable(
          () => client.products.get(locationId, productId),
          mapStorefrontProduct,
        ),
    },
  };
}
