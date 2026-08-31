import { ShoppingBag } from "lucide-react";
import { type LinkProps } from "next/link";

import { ButtonLink } from "@/components/ui/button";
import type { EmptyCartCopy } from "@/content/cart";

type CartEmptyProps = {
  browseHref: LinkProps["href"];
  copy: EmptyCartCopy;
  mainId?: string;
};

function EmptyCartIcon() {
  return (
    <ShoppingBag
      aria-hidden="true"
      className="size-[var(--size-icon-sm)] text-[var(--color-text-muted)] [stroke-width:var(--stroke-default)] lg:hidden"
      data-empty-cart-icon
    />
  );
}

export function CartEmpty({ browseHref, copy, mainId = "storefront-main" }: CartEmptyProps) {
  return (
    <main
      aria-labelledby="empty-cart-title"
      className="flex min-h-[calc(100dvh-var(--shell-mobile-nav-height))] w-full flex-1 items-center justify-center bg-[var(--color-surface-page)] px-[var(--space-5)] py-[var(--space-10)]"
      id={mainId}
      tabIndex={-1}
    >
      <div className="flex w-full max-w-[var(--layout-content)] -translate-y-[var(--space-9)] flex-col items-center gap-[var(--space-8)] text-center lg:translate-y-0">
        <EmptyCartIcon />
        <div className="flex w-full flex-col items-center gap-[var(--space-3)]">
          <h1
            className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-heading-md)] font-[number:var(--font-display-style)] leading-[normal] [color:var(--color-text-primary)] lg:text-[length:var(--text-heading-lg)]"
            id="empty-cart-title"
          >
            {copy.heading}
          </h1>
          <p className="m-0 max-w-[calc(var(--layout-content)-var(--space-12)-var(--space-5)-var(--space-3))] text-[length:var(--text-label-md)] font-[number:var(--font-body-style)] leading-[normal] [color:var(--color-text-secondary)] lg:max-w-none lg:text-[length:var(--text-body-sm)]">
            {copy.description}
          </p>
          <ButtonLink
            className="!w-auto"
            href={browseHref}
          >
            {copy.browseLabel}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
