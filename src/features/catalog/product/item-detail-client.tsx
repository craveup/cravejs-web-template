"use client";

import type { CatalogItemView } from "../catalog-types";
import { AddedToCart } from "./added-to-cart";
import { ItemDetailResourceState } from "./item-detail-resource-state";
import { ItemSheet } from "./item-sheet";
import { ProductCartFeedback } from "./product-cart-feedback";
import type { ProductCartRuntime } from "./product-cart-runtime";
import { useProductCart } from "./use-product-cart";
import { useProductDetail } from "./use-product-detail";

export interface ItemDetailClientProps {
  locationId: string;
  productId: string;
  menuHref: string;
  similarItems: CatalogItemView[];
  recommendations: CatalogItemView[];
  catalogMode: "fixture" | "live";
  locale: string;
  cartRuntime?: ProductCartRuntime;
  categoryId?: string;
}

export function ItemDetailClient({
  locationId,
  productId,
  menuHref,
  similarItems,
  recommendations,
  catalogMode,
  locale,
  cartRuntime,
  categoryId,
}: ItemDetailClientProps) {
  const resource = useProductDetail(locationId, productId, {
    catalogMode,
    locale,
  });
  const productCart = useProductCart(
    cartRuntime,
    locationId,
    productId,
    categoryId,
  );

  if (resource.status === "loading") {
    return <ItemDetailResourceState state={resource} menuHref={menuHref} />;
  }

  if (resource.status === "error") {
    return (
      <ItemDetailResourceState
        state={resource}
        menuHref={menuHref}
        onRetry={() => void resource.retry()}
      />
    );
  }

  if (resource.status === "not-found") {
    return <ItemDetailResourceState state={resource} menuHref={menuHref} />;
  }

  if (productCart.state.status === "succeeded") {
    return (
      <AddedToCart
        cart={productCart.state.cart}
        cartHref={`/${encodeURIComponent(locationId)}/cart`}
        recommendations={recommendations}
      />
    );
  }

  const submissionBlocked =
    productCart.state.status === "retry-required" ||
    productCart.state.status === "retryable" ||
    productCart.state.status === "error";

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">
        {resource.refreshing
          ? "Refreshing item details."
          : resource.refreshMessage
            ? "Item refresh failed. Showing the last available details."
            : ""}
      </span>
      <ItemSheet
        key={resource.data.id}
        item={resource.data}
        similarItems={similarItems}
        onSubmit={cartRuntime && !submissionBlocked ? productCart.submit : undefined}
        pending={productCart.state.status === "pending"}
        groupError={
          productCart.state.status === "retry-required" ||
          productCart.state.status === "error"
            ? productCart.state.groupError
            : undefined
        }
      />
      {!cartRuntime ? (
        <ProductCartFeedback state={{ status: "unavailable" }} />
      ) : productCart.state.status === "retry-required" ? (
        <ProductCartFeedback
          state={productCart.state}
          onRetryConflict={() => void productCart.retryConflict()}
        />
      ) : productCart.state.status === "retryable" ? (
        <ProductCartFeedback
          state={productCart.state}
          onRetry={() => void productCart.retry()}
        />
      ) : productCart.state.status === "error" ? (
        <ProductCartFeedback state={productCart.state} />
      ) : null}
    </>
  );
}
