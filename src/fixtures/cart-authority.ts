import type {
  AddCartItemPayload,
  CartItem,
  CartModifierGroup,
  Modifier,
  ModifierItem,
  Product,
  SelectedModifierTypes,
  StorefrontCart,
  FulfilmentMethod,
} from "@craveup/storefront-sdk";

import { StorefrontCartActionError } from "@/lib/storefront/cart-actions";

import { fixtureProductsById } from "./catalog";

const products: Readonly<Record<string, Product>> = fixtureProductsById;

const decimalPattern = /^\d+(?:\.\d{1,2})?$/;

function validationError(message: string): StorefrontCartActionError {
  return new StorefrontCartActionError({
    state: "validation",
    code: "VALIDATION_ERROR",
    message,
  });
}

function toCents(value: string): number {
  if (!decimalPattern.test(value)) {
    throw validationError("The fixture price is invalid.");
  }
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) {
    throw validationError("The fixture price is outside the supported range.");
  }
  return cents;
}

function decimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw validationError("The fixture total is invalid.");
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function formatted(cents: number): string {
  return `$${decimal(cents)}`;
}

function safeSum(values: readonly number[]): number {
  const sum = values.reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(sum)) {
    throw validationError("The fixture total is outside the supported range.");
  }
  return sum;
}

function modifierGroups(groups: readonly Modifier[]): Modifier[] {
  const all = new Map<string, Modifier>();
  const visit = (group: Modifier) => {
    if (all.has(group.id)) return;
    all.set(group.id, group);
    for (const item of group.items) {
      for (const child of item.childGroups ?? []) {
        if (child.group) visit(child.group);
      }
    }
  };
  groups.forEach(visit);
  return [...all.values()];
}

function requireModifierItem(group: Modifier, optionId: string): ModifierItem {
  const item = group.items.find((candidate) => candidate.id === optionId);
  if (!item) throw validationError("The fixture modifier option is invalid.");
  return item;
}

interface AllowedGroup {
  readonly group: Modifier;
  readonly minimum: number;
  readonly maximum: number;
  readonly quantityFactor: number;
}

function uniqueSelections(
  selections: readonly SelectedModifierTypes[],
): Map<string, SelectedModifierTypes> {
  const byGroup = new Map<string, SelectedModifierTypes>();
  for (const selection of selections) {
    if (byGroup.has(selection.groupId)) {
      throw validationError("The fixture modifier group is duplicated.");
    }
    byGroup.set(selection.groupId, selection);
  }
  return byGroup;
}

function mapSelections(
  selections: readonly SelectedModifierTypes[],
  allowedGroups: readonly AllowedGroup[],
): { readonly groups: CartModifierGroup[]; readonly unitCents: number } {
  const selectionsByGroup = uniqueSelections(selections);
  const allowedById = new Map(
    allowedGroups.map((allowed) => [allowed.group.id, allowed]),
  );
  if ([...selectionsByGroup.keys()].some((groupId) => !allowedById.has(groupId))) {
    throw validationError("The fixture modifier group is invalid.");
  }

  for (const allowed of allowedGroups) {
    const count =
      selectionsByGroup
        .get(allowed.group.id)
        ?.selectedOptions.reduce((total, selected) => total + selected.quantity, 0) ??
      0;
    if (
      !Number.isSafeInteger(allowed.minimum) ||
      !Number.isSafeInteger(allowed.maximum) ||
      allowed.minimum < 0 ||
      allowed.maximum < allowed.minimum ||
      count < allowed.minimum ||
      count > allowed.maximum
    ) {
      throw validationError("The fixture modifier selection count is invalid.");
    }
  }

  let unitCents = 0;
  const mapped = selections.map((selection): CartModifierGroup => {
    const allowed = allowedById.get(selection.groupId);
    if (!allowed) throw validationError("The fixture modifier group is invalid.");
    const { group } = allowed;
    const optionIds = new Set<string>();
    const items = selection.selectedOptions.map((selected) => {
      if (optionIds.has(selected.optionId)) {
        throw validationError("The fixture modifier option is duplicated.");
      }
      optionIds.add(selected.optionId);
      const option = requireModifierItem(group, selected.optionId);
      if (
        !Number.isSafeInteger(selected.quantity) ||
        selected.quantity < 1 ||
        selected.quantity > option.maxQuantity * allowed.quantityFactor
      ) {
        throw validationError("The fixture modifier quantity is invalid.");
      }
      const optionCents = toCents(option.price);
      const childGroups = (option.childGroups ?? []).map((link) => {
        const child = link.group;
        if (!child) {
          throw validationError("The fixture child modifier group is missing.");
        }
        const quantityFactor = link.applyPerParentQuantity
          ? selected.quantity
          : 1;
        return {
          group: child,
          minimum: (link.overrides?.min ?? child.rule.min) * quantityFactor,
          maximum: (link.overrides?.max ?? child.rule.max) * quantityFactor,
          quantityFactor,
        };
      });
      const children = mapSelections(selected.children ?? [], childGroups);
      unitCents = safeSum([
        unitCents,
        optionCents * selected.quantity,
        children.unitCents,
      ]);
      return {
        id: option.id,
        name: option.name,
        price: option.price,
        priceFormatted:
          optionCents > 0 ? `+${formatted(optionCents)}` : formatted(0),
        quantity: selected.quantity,
        ...(children.groups.length ? { children: children.groups } : {}),
      };
    });
    return {
      id: group.id,
      name: group.name,
      rule: { min: allowed.minimum, max: allowed.maximum },
      items,
    };
  });
  return { groups: mapped, unitCents };
}

function itemUnitCents(item: CartItem): number {
  const modifiers = (groups: readonly CartModifierGroup[]): number =>
    groups.reduce(
      (groupTotal, group) =>
        groupTotal +
        group.items.reduce(
          (itemTotal, modifier) =>
            itemTotal +
            toCents(modifier.price) * modifier.quantity +
            modifiers(modifier.children ?? []) * modifier.quantity,
          0,
        ),
      0,
    );
  return toCents(item.price) + modifiers(item.selections);
}

function withAuthoritativeTotals(
  cart: StorefrontCart,
  items: CartItem[],
  revision: number,
  status: StorefrontCart["status"] = cart.status,
): StorefrontCart {
  const subTotalCents = safeSum(
    items.map((item) => itemUnitCents(item) * item.quantity),
  );
  const taxRate = Number(cart.fees.taxRate);
  if (!Number.isFinite(taxRate) || taxRate < 0) {
    throw validationError("The fixture tax rate is invalid.");
  }
  const taxCents = Math.round(subTotalCents * taxRate);
  const fulfillmentFeeCents = toCents(cart.fulfillmentMethodFeeTotal);
  const taxAndFeeCents = safeSum([taxCents, fulfillmentFeeCents]);
  const totalCents = safeSum([subTotalCents, taxAndFeeCents]);
  const totalQuantity = safeSum(items.map((item) => item.quantity));

  return {
    ...cart,
    status,
    revision,
    items,
    totalQuantity,
    subTotal: decimal(subTotalCents),
    subTotalFormatted: formatted(subTotalCents),
    subTotalWithoutDiscount: decimal(subTotalCents),
    subTotalWithoutDiscountFormatted: formatted(subTotalCents),
    netSalesTotal: decimal(subTotalCents),
    netSalesTotalFormatted: formatted(subTotalCents),
    taxTotal: decimal(taxCents),
    taxTotalFormatted: formatted(taxCents),
    taxAndFeeTotal: decimal(taxAndFeeCents),
    taxAndFeeTotalFormatted: formatted(taxAndFeeCents),
    orderTotal: decimal(totalCents),
    orderTotalFormatted: formatted(totalCents),
    orderTotalWithServiceFee: decimal(totalCents),
    orderTotalWithServiceFeeFormatted: formatted(totalCents),
    orderTotalWithServiceFeeAmount: totalCents,
  };
}

function nextItemId(cart: StorefrontCart, productId: string): string {
  if (!cart.items.some((item) => item.id === productId)) return productId;
  let suffix = 2;
  while (cart.items.some((item) => item.id === `${productId}-${suffix}`)) {
    suffix += 1;
  }
  return `${productId}-${suffix}`;
}

export function addFixtureCartItem(
  cart: StorefrontCart,
  payload: AddCartItemPayload,
): StorefrontCart {
  const product = products[payload.productId];
  if (!product || product.availability !== "available") {
    throw validationError("The fixture product is unavailable.");
  }
  if (!Number.isSafeInteger(payload.quantity) || payload.quantity < 1) {
    throw validationError("The fixture cart item quantity is invalid.");
  }
  const groups = modifierGroups(product.modifiers);
  const rootGroups = product.modifierIds.map((groupId) => {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group) throw validationError("The fixture modifier group is missing.");
    return {
      group,
      minimum: group.rule.min,
      maximum: group.rule.max,
      quantityFactor: 1,
    };
  });
  const mapped = mapSelections(payload.selections, rootGroups);
  const unitCents = safeSum([toCents(product.price), mapped.unitCents]);
  if (
    payload.specialInstructions !== undefined &&
    (payload.specialInstructions.trim() !== payload.specialInstructions ||
      payload.specialInstructions.length > 1_000)
  ) {
    throw validationError("The fixture special instructions are invalid.");
  }
  const item: CartItem = {
    id: nextItemId(cart, product.id),
    productId: product.id,
    name: product.name,
    description: product.description ?? "",
    imageUrl: product.images[0] ?? "",
    price: product.price,
    priceFormatted: product.displayPrice,
    quantity: payload.quantity,
    total: decimal(unitCents * payload.quantity),
    totalFormatted: formatted(unitCents * payload.quantity),
    discount: "0.00",
    discountFormatted: "$0.00",
    categoryId: payload.categoryId ?? null,
    ...(payload.specialInstructions
      ? { specialInstructions: payload.specialInstructions }
      : {}),
    itemUnavailableAction: payload.itemUnavailableAction,
    selections: mapped.groups,
  };
  return withAuthoritativeTotals(
    cart,
    [...cart.items, item],
    cart.revision + 1,
  );
}

export function updateFixtureCartItemQuantity(
  cart: StorefrontCart,
  itemId: string,
  quantity: number,
): StorefrontCart {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw validationError("The fixture cart item quantity is invalid.");
  }
  const index = cart.items.findIndex((item) => item.id === itemId);
  if (index < 0) throw validationError("The fixture cart item is unavailable.");
  const items = cart.items.map((item, position) => {
    if (position !== index) return item;
    const totalCents = itemUnitCents(item) * quantity;
    return {
      ...item,
      quantity,
      total: decimal(totalCents),
      totalFormatted: formatted(totalCents),
    };
  });
  return withAuthoritativeTotals(cart, items, cart.revision + 1);
}

export function removeFixtureCartItem(
  cart: StorefrontCart,
  itemId: string,
): StorefrontCart {
  if (!cart.items.some((item) => item.id === itemId)) {
    throw validationError("The fixture cart item is unavailable.");
  }
  return withAuthoritativeTotals(
    cart,
    cart.items.filter((item) => item.id !== itemId),
    cart.revision + 1,
  );
}

export function expireFixtureCart(cart: StorefrontCart): StorefrontCart {
  return withAuthoritativeTotals(cart, [], cart.revision + 1, "EXPIRED");
}

const fulfillmentFeeByMethod: Readonly<Record<FulfilmentMethod, number>> = {
  delivery: 400,
  takeout: 0,
  table_side: 0,
  room_service: 360,
};

export function changeFixtureFulfillmentMethod(
  cart: StorefrontCart,
  fulfillmentMethod: FulfilmentMethod,
): StorefrontCart {
  const feeCents = fulfillmentFeeByMethod[fulfillmentMethod];
  const fee = decimal(feeCents);
  const next = {
    ...cart,
    fulfilmentMethod: fulfillmentMethod,
    fulfillmentIdentifier:
      fulfillmentMethod === "takeout" ? "Pickup counter" : "",
    fees: {
      ...cart.fees,
      fulfillmentMethodFeeFix: fee,
      fulfillmentMethodFeeRate: "0.00",
    },
    fulfillmentMethodFeeTotal: fee,
    fulfillmentMethodFeeTotalFormatted: formatted(feeCents),
    deliveryInfo: null,
    tableServiceInfo: null,
    roomServiceInfo: null,
  };
  return withAuthoritativeTotals(next, [...cart.items], cart.revision + 1);
}
