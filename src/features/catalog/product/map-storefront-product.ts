import { formatMoney } from "@/lib/money/format-money";
import type {
  StorefrontModifierGroup,
  StorefrontModifierGroupLink,
  StorefrontProductDetail,
} from "@/lib/storefront/catalog";

import type {
  ItemDetailView,
  ItemModifierGroupLinkView,
  ItemModifierGroupView,
} from "./item-types";

export class ItemDetailMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemDetailMappingError";
  }
}

const zeroDecimal = /^-?0(?:\.0+)?$/;

function groupSignature(group: StorefrontModifierGroup): string {
  return JSON.stringify({
    id: group.id,
    name: group.name,
    description: group.description,
    rule: group.rule,
    items: group.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      maximumQuantity: item.maximumQuantity,
      childGroups: item.childGroups?.map((link) => ({
        modifierGroupId: link.modifierGroupId,
        minimum: link.minimum,
        maximum: link.maximum,
        applyPerParentQuantity: link.applyPerParentQuantity,
        circular: link.circular,
      })),
    })),
  });
}

function displayDelta(
  price: string,
  currency: string,
  locale: string,
): string | undefined {
  if (zeroDecimal.test(price)) return undefined;
  return formatMoney(price, currency, locale, { signDisplay: "always" });
}

function mapLink(link: StorefrontModifierGroupLink): ItemModifierGroupLinkView {
  return {
    modifierGroupId: link.modifierGroupId,
    minimum: link.minimum,
    maximum: link.maximum,
    applyPerParentQuantity: link.applyPerParentQuantity,
  };
}

export function mapStorefrontProductDetail(
  product: StorefrontProductDetail,
  locale: string,
): ItemDetailView {
  const orderedGroups = new Map<string, StorefrontModifierGroup>();
  const signatures = new Map<string, string>();

  function visitGroup(
    group: StorefrontModifierGroup,
    ancestors: ReadonlySet<string>,
  ): void {
    if (ancestors.has(group.id)) {
      throw new ItemDetailMappingError(
        `Modifier group ${group.id} contains a cycle.`,
      );
    }

    const signature = groupSignature(group);
    const existingSignature = signatures.get(group.id);
    if (existingSignature !== undefined && existingSignature !== signature) {
      throw new ItemDetailMappingError(
        `Modifier group ${group.id} has conflicting definitions.`,
      );
    }
    if (existingSignature === undefined) {
      orderedGroups.set(group.id, group);
      signatures.set(group.id, signature);
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(group.id);

    for (const option of group.items) {
      for (const link of option.childGroups ?? []) {
        if (link.circular) {
          throw new ItemDetailMappingError(
            `Modifier group ${link.modifierGroupId} contains a cycle.`,
          );
        }
        if (link.group) visitGroup(link.group, nextAncestors);
      }
    }
  }

  for (const group of product.modifierGroups) visitGroup(group, new Set());

  for (const rootGroupId of product.rootModifierGroupIds) {
    if (!orderedGroups.has(rootGroupId)) {
      throw new ItemDetailMappingError(
        `Modifier group ${rootGroupId} is missing.`,
      );
    }
  }
  for (const group of orderedGroups.values()) {
    for (const option of group.items) {
      for (const link of option.childGroups ?? []) {
        if (!orderedGroups.has(link.modifierGroupId)) {
          throw new ItemDetailMappingError(
            `Modifier group ${link.modifierGroupId} is missing.`,
          );
        }
      }
    }
  }

  const modifierGroups: ItemModifierGroupView[] = Array.from(
    orderedGroups.values(),
    (group) => ({
      id: group.id,
      name: group.name,
      minimum: group.rule.minimum,
      maximum: group.rule.maximum,
      options: group.items.map((option) => ({
        id: option.id,
        name: option.name,
        formattedPriceDelta: displayDelta(
          option.price,
          product.currency,
          locale,
        ),
        available: option.maximumQuantity > 0,
        maximumQuantity: option.maximumQuantity,
        childGroups: option.childGroups?.map(mapLink),
      })),
    }),
  );

  const available = product.availability === "available";
  return {
    id: product.id,
    name: product.name,
    description: product.description || undefined,
    imageSrc: product.images.find((image) => image.length > 0),
    formattedPrice: product.displayPrice,
    availability: available ? "available" : "sold-out",
    unavailableMessage: available
      ? undefined
      : "This item is unavailable right now.",
    rootModifierGroups: product.rootModifierGroupIds.map((modifierGroupId) => ({
      modifierGroupId,
    })),
    modifierGroups,
  };
}
