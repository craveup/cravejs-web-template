"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface CatalogNavigationItem {
  id: string;
  label: string;
  href: string;
}

export interface CatalogNavigationProps {
  brand: string;
  brandHref?: string;
  items: CatalogNavigationItem[];
  actionItems?: CatalogNavigationItem[];
  addressLabel?: string;
  cartLabel?: string;
  desktopAction?: CatalogNavigationItem;
}

function NavigationLinks({
  items,
  onNavigate,
}: {
  items: CatalogNavigationItem[];
  onNavigate?: () => void;
}) {
  return items.map((item) => (
    <Link href={item.href} key={item.id} onClick={onNavigate}>
      {item.label}
    </Link>
  ));
}

export function CatalogNavigation({
  brand,
  brandHref = "#store-details",
  items,
  actionItems = [],
  addressLabel,
  cartLabel = "Cart",
  desktopAction,
}: CatalogNavigationProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const breakpoint = getComputedStyle(document.documentElement)
      .getPropertyValue("--layout-bp-lg")
      .trim();
    if (!breakpoint) return;

    const desktop = window.matchMedia(`(min-width: ${breakpoint})`);
    const closeAtDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setOpen(false);
    };
    closeAtDesktop(desktop);
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button className="header-icon-button mobile-menu-trigger" type="button" aria-label="Open menu">
            <Menu aria-hidden="true" />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="navigation-overlay" />
          <Dialog.Content className="navigation-drawer">
            <Dialog.Title className="sr-only">Store navigation</Dialog.Title>
            <Dialog.Description className="sr-only">
              Browse this restaurant and available storefront destinations.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button className="drawer-close" type="button" aria-label="Close menu">
                <X aria-hidden="true" />
              </button>
            </Dialog.Close>
            <p className="drawer-brand">{brand}</p>
            <nav className="drawer-links" aria-label="Mobile navigation">
              <NavigationLinks items={items} onNavigate={() => setOpen(false)} />
            </nav>
            {actionItems.length ? (
              <nav className="drawer-actions" aria-label="Account and fulfillment">
                <NavigationLinks items={actionItems} onNavigate={() => setOpen(false)} />
              </nav>
            ) : null}
            <footer className="drawer-footer">
              {addressLabel ? <address>{addressLabel}</address> : null}
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Link className="header-brand" href={brandHref}>
        {brand}
      </Link>
      <nav className="desktop-navigation" aria-label="Store navigation">
        <NavigationLinks items={items} />
      </nav>
      <span className="header-cart" role="img" aria-label={cartLabel}>
        <ShoppingBag aria-hidden="true" />
        <span className="header-cart-label">{cartLabel}</span>
      </span>
      {desktopAction ? (
        <Link className="header-desktop-action" href={desktopAction.href}>
          {desktopAction.label}
        </Link>
      ) : null}
    </>
  );
}
