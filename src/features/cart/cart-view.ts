import type {
  CartModifierGroup,
  CartModifierItem,
  StorefrontCart,
} from "@craveup/storefront-sdk";

import type { CartMessages } from "@/content/cart";
import type { FulfillmentDescription } from "@/features/fulfillment/types";

import type { CartModifierView } from "./cart-line";
import type { CartPageView } from "./cart-page";

export interface CartViewLocation {
  readonly name: string;
  readonly addressLabel?: string;
}

function fulfillmentLabel(
  location: CartViewLocation,
  messages: CartMessages,
  cart: StorefrontCart,
  tablesideDescription?: FulfillmentDescription,
): string {
  if (tablesideDescription) {
    return `${tablesideDescription.modeLabel} · ${tablesideDescription.summary}`;
  }

  switch (cart.fulfilmentMethod) {
    case "delivery":
      return messages.deliveryLabel(
        cart.restaurantDisplayName,
        cart.deliveryInfo?.addressString ?? location.addressLabel ?? "",
      );
    case "takeout":
      return messages.pickupLabel(
        cart.restaurantDisplayName,
        location.addressLabel ?? "",
      );
    case "table_side":
      return messages.tableServiceLabel(
        cart.tableServiceInfo?.tableNumber
          ? `Table ${cart.tableServiceInfo.tableNumber}`
          : cart.fulfillmentIdentifier,
      );
    case "room_service":
      return messages.roomServiceLabel(
        cart.roomServiceInfo?.roomNumber
          ? `Room ${cart.roomServiceInfo.roomNumber}`
          : cart.fulfillmentIdentifier,
      );
  }
}

function fulfillmentFeeLabel(
  messages: CartMessages,
  cart: StorefrontCart,
): string | undefined {
  switch (cart.fulfilmentMethod) {
    case "delivery":
      return messages.deliveryFeeLabel;
    case "takeout":
      return messages.pickupFeeLabel;
    case "room_service":
      return messages.roomServiceFeeLabel;
    case "table_side":
      return undefined;
  }
}

function mapModifierItem(item: CartModifierItem): CartModifierView {
  const children: CartModifierView[] =
    item.children?.flatMap(mapModifierGroup) ?? [];
  return {
    id: item.id,
    label:
      item.price === "0" || item.price === "0.00"
        ? item.name
        : `${item.name} · ${item.priceFormatted}`,
    children,
  };
}

function mapModifierGroup(group: CartModifierGroup): CartModifierView[] {
  return group.items.map(mapModifierItem);
}

export function createCartPageView(
  location: CartViewLocation,
  messages: CartMessages,
  cart?: StorefrontCart,
  tablesideDescription?: FulfillmentDescription,
): CartPageView {
  if (!cart || cart.items.length === 0) {
    return {
      locationLabel: cart?.restaurantDisplayName ?? location.name,
      headerCartLabel: cart
        ? messages.headerCartLabel(
            cart.totalQuantity,
            cart.orderTotalWithServiceFeeFormatted,
          )
        : "Cart",
      heading: messages.heading,
      fulfillmentLabel: "",
      emptyState: messages.emptyState,
      items: [],
      summaryRows: [],
      formattedTotal: "",
      checkoutLabel: "",
      clearLabel: messages.clearLabel,
      itemsRegionLabel: messages.itemsRegionLabel,
      summaryRegionLabel: messages.summaryRegionLabel,
      orderSummaryLabel: messages.orderSummaryLabel,
      totalLabel: messages.totalLabel,
      checkoutUnavailableTitle: messages.checkoutUnavailableTitle,
    };
  }

  const isTableside = cart.fulfilmentMethod === "table_side";
  const feeLabel = fulfillmentFeeLabel(messages, cart);

  return {
    locationLabel: cart.restaurantDisplayName,
    headerCartLabel: messages.headerCartLabel(
      cart.totalQuantity,
      cart.orderTotalWithServiceFeeFormatted,
    ),
    heading: messages.heading,
    fulfillmentLabel: fulfillmentLabel(
      location,
      messages,
      cart,
      tablesideDescription,
    ),
    emptyState: messages.emptyState,
    items: cart.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: isTableside ? item.description : undefined,
      imageSrc: item.imageUrl,
      formattedLineTotal: item.totalFormatted,
      quantity: item.quantity,
      modifiers: item.selections.flatMap(mapModifierGroup),
      specialInstructions: item.specialInstructions,
      quantityLabel: messages.quantityLabel(item.name),
      decreaseQuantityLabel: messages.decreaseQuantityLabel(item.name),
      increaseQuantityLabel: messages.increaseQuantityLabel(item.name),
      removeLabel: messages.removeLabel,
      specialRequestLabel: messages.specialRequestLabel,
    })),
    summaryRows: [
      {
        id: "subtotal",
        label: messages.subtotalLabel,
        formattedValue: cart.subTotalFormatted,
      },
      ...(feeLabel === undefined
        ? []
        : [
            {
              id: "delivery-fee",
              label: feeLabel,
              formattedValue: cart.fulfillmentMethodFeeTotalFormatted,
            },
          ]),
      {
        id: "tax",
        label: messages.taxLabel,
        formattedValue: cart.taxTotalFormatted,
      },
    ],
    formattedTotal: cart.orderTotalWithServiceFeeFormatted,
    checkoutLabel: isTableside
      ? messages.tableside.checkoutLabel
      : messages.checkoutLabel(cart.orderTotalWithServiceFeeFormatted),
    clearLabel: messages.clearLabel,
    itemsRegionLabel: messages.itemsRegionLabel,
    summaryRegionLabel: messages.summaryRegionLabel,
    orderSummaryLabel: messages.orderSummaryLabel,
    totalLabel: messages.totalLabel,
    checkoutUnavailableTitle: messages.checkoutUnavailableTitle,
    tableside:
      isTableside && tablesideDescription
        ? {
            sourceLabel: messages.tableside.sourceLabel,
            locationLabel: cart.restaurantDisplayName,
            tableLabel: tablesideDescription.summary,
            changeLabel: messages.tableside.changeLabel,
            changeHref: tablesideDescription.changeHref,
            contextRegionLabel: messages.tableside.contextRegionLabel,
            previewLabel: messages.tableside.previewLabel,
            bannerLabel: messages.tableside.bannerLabel(
              tablesideDescription.summary,
            ),
            itemsHeading: messages.tableside.itemsHeading,
          }
        : undefined,
  };
}
