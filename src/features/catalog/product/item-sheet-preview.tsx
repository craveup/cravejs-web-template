"use client";

import type { StorefrontCart } from "@craveup/storefront-sdk";

import type { CatalogItemView } from "../catalog-types";
import { AddedToCart } from "./added-to-cart";
import { ItemSheet } from "./item-sheet";
import {
  ProductCartFeedback,
  type ProductCartFeedbackView,
} from "./product-cart-feedback";
import type {
  ItemDetailView,
  ModifierGroupValidationError,
} from "./item-types";

export function ItemSheetPreview({
  item,
  similarItems,
  recommendations,
  addedCart,
  groupError,
  cartFeedback,
}: {
  item: ItemDetailView;
  similarItems: CatalogItemView[];
  recommendations?: CatalogItemView[];
  addedCart?: StorefrontCart;
  groupError?: ModifierGroupValidationError;
  cartFeedback?: ProductCartFeedbackView;
}) {
  if (addedCart) {
    return (
      <AddedToCart
        cart={addedCart}
        cartHref="/demo/cart"
        recommendations={recommendations ?? []}
      />
    );
  }

  return (
    <>
      <ItemSheet
        item={item}
        similarItems={similarItems}
        onSubmit={cartFeedback ? undefined : () => undefined}
        groupError={groupError}
      />
      {cartFeedback ? <ProductCartFeedback state={cartFeedback} /> : null}
    </>
  );
}
