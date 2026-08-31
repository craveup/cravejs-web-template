import type { StorefrontCart } from "@craveup/storefront-sdk";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { MenuItemCard } from "@/components/ui/menu-item-card";

import type { CatalogItemView } from "../catalog-types";

export interface AddedToCartProps {
  readonly cart: StorefrontCart;
  readonly cartHref: string;
  readonly recommendations: readonly CatalogItemView[];
}

export function AddedToCart({
  cart,
  cartHref,
  recommendations,
}: AddedToCartProps) {
  const itemLabel = `${cart.totalQuantity} ${cart.totalQuantity === 1 ? "item" : "items"}`;
  const accessibleCartLabel = `Go to cart, ${itemLabel}, ${cart.orderTotalWithServiceFeeFormatted}`;

  return (
    <article className="added-to-cart">
      <div className="added-to-cart-banner" role="status" aria-live="polite">
        <strong>Added to your order</strong>
        <Link href={cartHref} aria-label="View cart">
          <span className="added-to-cart-view-short">View</span>
          <span className="added-to-cart-view-full">View cart</span>
        </Link>
      </div>
      <div className="added-to-cart-content">
        {recommendations.length ? (
          <section aria-labelledby="goes-well-with-title">
            <h1 id="goes-well-with-title">Goes well with</h1>
            <div className="added-to-cart-recommendations">
              {recommendations.slice(0, 3).map((item, index) => (
                <MenuItemCard
                  key={item.id}
                  {...item}
                  layout="list"
                  eager={index === 0}
                />
              ))}
            </div>
          </section>
        ) : null}
        <div className="added-to-cart-action">
          <ButtonLink href={cartHref} aria-label={accessibleCartLabel}>
            Go to cart · {itemLabel} · {cart.orderTotalWithServiceFeeFormatted}
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
