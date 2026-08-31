import {
  CatalogNavigation,
  type CatalogNavigationItem,
} from "@/features/catalog/navigation/mobile-navigation";

export interface StorefrontHeaderProps {
  brand: string;
  brandHref?: string;
  items: CatalogNavigationItem[];
  actionItems?: CatalogNavigationItem[];
  addressLabel?: string;
  cartLabel?: string;
  desktopAction?: CatalogNavigationItem;
}

export function StorefrontHeader(props: StorefrontHeaderProps) {
  return (
    <header className="storefront-header">
      <div className="storefront-header-inner">
        <CatalogNavigation {...props} />
      </div>
    </header>
  );
}
