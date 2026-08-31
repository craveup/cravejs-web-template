export interface EmptyCartCopy {
  heading: string;
  description: string;
  browseLabel: string;
}

export interface TablesideCartMessages {
  sourceLabel: string;
  changeLabel: string;
  contextRegionLabel: string;
  previewLabel: string;
  bannerLabel: (tableLabel: string) => string;
  itemsHeading: string;
  checkoutLabel: string;
}

export interface CartMessages {
  headerCartLabel: (quantity: number, formattedTotal: string) => string;
  heading: string;
  emptyState: EmptyCartCopy;
  deliveryLabel: (restaurantName: string, address: string) => string;
  pickupLabel: (restaurantName: string, address: string) => string;
  tableServiceLabel: (identifier: string) => string;
  roomServiceLabel: (identifier: string) => string;
  clearLabel: string;
  itemsRegionLabel: string;
  summaryRegionLabel: string;
  orderSummaryLabel: string;
  totalLabel: string;
  checkoutUnavailableTitle: string;
  removeLabel: string;
  specialRequestLabel: string;
  quantityLabel: (itemName: string) => string;
  decreaseQuantityLabel: (itemName: string) => string;
  increaseQuantityLabel: (itemName: string) => string;
  subtotalLabel: string;
  deliveryFeeLabel: string;
  pickupFeeLabel: string;
  roomServiceFeeLabel: string;
  taxLabel: string;
  checkoutLabel: (formattedTotal: string) => string;
  tableside: TablesideCartMessages;
}

const enUsCartMessages: CartMessages = {
  headerCartLabel: (quantity, formattedTotal) =>
    `Cart · ${quantity} ${quantity === 1 ? "item" : "items"} · ${formattedTotal}`,
  heading: "Your order",
  emptyState: {
    heading: "Your cart is empty",
    description: "Add something from the menu and it will show up here.",
    browseLabel: "Browse the menu",
  },
  deliveryLabel: (restaurantName, address) =>
    `Delivery · ${restaurantName}, ${address}`,
  pickupLabel: (restaurantName, address) =>
    `Pickup · ${restaurantName}${address ? `, ${address}` : ""}`,
  tableServiceLabel: (identifier) => `Table service · ${identifier}`,
  roomServiceLabel: (identifier) => `Room service · ${identifier}`,
  clearLabel: "Clear",
  itemsRegionLabel: "Cart items",
  summaryRegionLabel: "Cart total and checkout",
  orderSummaryLabel: "Order summary",
  totalLabel: "Total",
  checkoutUnavailableTitle: "Checkout is unavailable until the cart adapter is connected.",
  removeLabel: "Remove",
  specialRequestLabel: "Special request:",
  quantityLabel: (itemName) => `Quantity for ${itemName}`,
  decreaseQuantityLabel: (itemName) => `Decrease quantity for ${itemName}`,
  increaseQuantityLabel: (itemName) => `Increase quantity for ${itemName}`,
  subtotalLabel: "Subtotal",
  deliveryFeeLabel: "Delivery fee",
  pickupFeeLabel: "Pickup — no fee",
  roomServiceFeeLabel: "Service charge",
  taxLabel: "Tax",
  checkoutLabel: (formattedTotal) => `Checkout · ${formattedTotal}`,
  tableside: {
    sourceLabel: "Your cart from",
    changeLabel: "Change",
    contextRegionLabel: "Tableside order context",
    previewLabel: "Table ordering preview",
    bannerLabel: (tableLabel) => `${tableLabel} · Table ordering preview`,
    itemsHeading: "Your items",
    checkoutLabel: "Go to checkout",
  },
};

const cartMessagesByLocale: Readonly<Record<string, CartMessages>> = {
  "en-US": enUsCartMessages,
};

export function getCartMessages(locale: string): CartMessages {
  return cartMessagesByLocale[locale] ?? enUsCartMessages;
}
