import Image from "next/image";
import type { ReactNode } from "react";

import { OrderRail } from "@/components/shell/order-rail";
import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { MenuItemCard } from "@/components/ui/menu-item-card";
import type { StorefrontPreset } from "@/presets/storefront-presets";

import type {
  CatalogCategoryView,
  CatalogItemView,
  StoreHomeData,
  StoreHomeVariant,
} from "../catalog-types";
import { CategoryChips, CategoryNavigation } from "./category-navigation";
import { CatalogPageState } from "./catalog-page-state";
import type { FulfillmentMode } from "@/features/fulfillment/types";

export interface StoreHomeProps {
  data: StoreHomeData;
  variant: StoreHomeVariant;
  searchSlot?: ReactNode;
  entryContextSlot?: ReactNode;
  fulfillmentMode?: FulfillmentMode;
  visualPreset?: StorefrontPreset;
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="catalog-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

function selectItems(items: CatalogItemView[], ids: string[]) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = itemsById.get(id);
    return item ? [item] : [];
  });
}

function ProductGrid({
  items,
  eagerCount = 0,
  eagerFetchPriority,
}: {
  items: CatalogItemView[];
  eagerCount?: number;
  eagerFetchPriority?: "low";
}) {
  return (
    <div className="menu-item-grid">
      {items.map((item, index) => (
        <MenuItemCard
          key={item.id}
          {...item}
          layout="grid"
          eager={index < eagerCount}
          imageFetchPriority={index < eagerCount ? eagerFetchPriority : undefined}
        />
      ))}
    </div>
  );
}

function CategorySections({ categories }: { categories: CatalogCategoryView[] }) {
  return (
    <div className="category-sections">
      {categories.map((category) => (
        <section id={`category-${category.id}`} key={category.id} tabIndex={-1}>
          <SectionHeader title={category.name} description={category.description} />
          {category.items.length ? (
            <ProductGrid items={category.items} />
          ) : (
            <p className="category-empty">No items are currently available.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function HomeLayout({ data }: { data: StoreHomeData }) {
  return (
    <>
      <CategoryChips categories={data.categories} />
      <section id="most-ordered" tabIndex={-1}>
        <SectionHeader
          title="Most ordered"
          action={
            <a className="section-link" href="#full-menu" aria-label="See all most ordered items">
              See all
            </a>
          }
        />
        {/* React 19 otherwise promotes each eager supporting image to a head preload. */}
        <ProductGrid
          eagerCount={2}
          eagerFetchPriority="low"
          items={selectItems(data.featuredItems, [
            "double-smash-burger",
            "crinkle-fries",
            "chocolate-malt",
            "crispy-chicken-sandwich",
            "mushroom-burger",
            "side-salad",
          ])}
        />
      </section>
      <section className="full-menu-preview" id="full-menu" aria-labelledby="full-menu-title">
        <h2 id="full-menu-title">Full menu</h2>
        {data.categories.map((category) => (
          <a href={`#category-${category.id}`} key={category.id}>
            <span>{category.name}</span>
            <span>
              {category.items.length} {category.items.length === 1 ? "item" : "items"}
            </span>
          </a>
        ))}
      </section>
      <CategorySections categories={data.categories} />
    </>
  );
}

function CategoryScrollLayout({ data }: { data: StoreHomeData }) {
  return (
    <>
      <nav className="category-scroll-strip" aria-label="Browse sections">
        <a href="#most-ordered">Most ordered</a>
        <a href="#seasonal-menus">Seasonal menus</a>
      </nav>
      <section id="most-ordered" tabIndex={-1}>
        <SectionHeader title="Most ordered" />
        <ProductGrid
          eagerCount={1}
          items={selectItems(data.featuredItems, [
            "crispy-chicken-sandwich",
            "side-salad",
            "chocolate-malt",
            "crinkle-fries",
          ])}
        />
      </section>
      <section id="seasonal-menus" className="seasonal-menus" tabIndex={-1}>
        <SectionHeader title="Seasonal menus" />
        <div className="seasonal-menu-list">
          {data.categories
            .flatMap((category) => category.items)
            .slice(0, 3)
            .map((item) => (
              <MenuItemCard key={item.id} {...item} layout="list" />
            ))}
        </div>
      </section>
    </>
  );
}

function MenuCategoriesLayout({ data }: { data: StoreHomeData }) {
  return (
    <>
      <section className="service-context" aria-labelledby="service-context-title">
        {data.location.serviceHeroImageSrc ? (
          <div className="service-context-image">
            <Image
              src={data.location.serviceHeroImageSrc}
              alt=""
              fill
              preload
              sizes="(min-width: 1024px) 1px, 100vw"
            />
          </div>
        ) : null}
        <h1 id="service-context-title">
          {data.location.serviceTitle ?? data.location.name}
        </h1>
        {data.location.serviceEyebrow ? <p>{data.location.serviceEyebrow}</p> : null}
        {data.location.statusLabel ? <span>{data.location.statusLabel}</span> : null}
        {data.location.serviceEstimateLabel ? (
          <div className="service-estimate">
            <strong>{data.location.serviceEstimateLabel}</strong>
            {data.location.serviceEstimateDescription ? (
              <span>{data.location.serviceEstimateDescription}</span>
            ) : null}
          </div>
        ) : null}
      </section>
      <section className="menu-categories">
        <SectionHeader title="Menus" />
        <div className="menu-category-grid">
          {data.menuCategories.map((menu) => (
            <article key={menu.id}>
              {menu.imageSrc ? (
                <div className="menu-category-image">
                  <Image
                    src={menu.imageSrc}
                    alt=""
                    fill
                    loading="lazy"
                    sizes="(min-width: 1024px) 300px, 46vw"
                  />
                </div>
              ) : null}
              <h3>{menu.name}</h3>
              {menu.hoursLabel ? <p>{menu.hoursLabel}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function FullMenuLayout({ data }: { data: StoreHomeData }) {
  return (
    <>
      <CategoryChips categories={data.categories} />
      <section id="most-ordered" className="full-menu-featured" tabIndex={-1}>
        <SectionHeader title="Most ordered" />
        <ProductGrid
          eagerCount={1}
          items={selectItems(data.featuredItems, [
            "double-smash-burger",
            "chocolate-malt",
            "mushroom-burger",
            "crispy-chicken-sandwich",
            "crinkle-fries",
            "side-salad",
          ])}
        />
      </section>
      <div className="full-menu-list">
        {data.categories.map((category) => (
          <section id={`category-${category.id}`} key={category.id} tabIndex={-1}>
            <SectionHeader title={category.name} />
            {category.items.map((item) => (
              <MenuItemCard
                key={item.id}
                {...item}
                layout="list"
              />
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

function MenuTypeTabs() {
  return (
    <nav className="menu-type-tabs" aria-label="Menu types">
      <a href="#most-ordered">Food</a>
      <a href="#category-drinks">Non-alcoholic</a>
      <span aria-disabled="true">Beer & wine</span>
    </nav>
  );
}

function BrowseContent({ data, variant }: Pick<StoreHomeProps, "data" | "variant">) {
  if (variant === "category-scroll") return <CategoryScrollLayout data={data} />;
  if (variant === "menu-categories") return <MenuCategoriesLayout data={data} />;
  if (variant === "full-menu") return <FullMenuLayout data={data} />;
  return <HomeLayout data={data} />;
}

function StoreHero({
  data,
  visualPreset,
}: {
  data: StoreHomeData;
  visualPreset?: StorefrontPreset;
}) {
  const heroImageSrc = visualPreset?.heroImageSrc ?? data.location.heroImageSrc;
  if (!heroImageSrc) return null;
  return (
    <div className="store-hero">
      <Image
        src={heroImageSrc}
        alt=""
        fill
        preload
        sizes="(min-width: 1024px) 100vw, (min-width: 600px) 600px, 100vw"
      />
    </div>
  );
}

function StorefrontPresetHero({
  data,
  visualPreset,
}: {
  data: StoreHomeData;
  visualPreset: StorefrontPreset;
}) {
  return (
    <section
      className="storefront-preset-hero"
      data-composition={visualPreset.homeCompositionId}
    >
      <div className="store-hero storefront-preset-hero-media">
        <Image
          src={visualPreset.heroImageSrc}
          alt=""
          fill
          preload
          sizes="(min-width: 1024px) 100vw, (min-width: 600px) 600px, 100vw"
        />
      </div>
      <div className="storefront-preset-hero-copy">
        <div>
          <h1>{data.location.name}</h1>
          {data.location.statusLabel || data.location.addressLabel ? (
            <p>
              {data.location.statusLabel ? data.location.statusLabel : null}
              {data.location.statusLabel && data.location.addressLabel ? " · " : null}
              {data.location.addressLabel ? data.location.addressLabel : null}
            </p>
          ) : null}
        </div>
        {visualPreset.homeCompositionId === "service-first" &&
        data.location.fulfillmentSummary?.length ? (
          <dl className="storefront-preset-metrics" aria-label="Store fulfillment summary">
            {data.location.fulfillmentSummary.map((metric) => (
              <div key={metric.id}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <ButtonLink href="#menu">Browse menu</ButtonLink>
      </div>
    </section>
  );
}

function StoreIntro({ data, fulfillmentMode }: { data: StoreHomeData; fulfillmentMode?: FulfillmentMode }) {
  const contextLabel = fulfillmentMode
    ? { takeout: "Pickup", delivery: "Delivery", "table-side": "Table service", "room-service": "Room service" }[fulfillmentMode]
    : undefined;
  const showMetrics = !fulfillmentMode || fulfillmentMode === "takeout" || fulfillmentMode === "delivery";
  return (
    <section className="store-intro" id="store-details">
      <div>
        <h1>{data.location.name}</h1>
        {data.location.statusLabel || data.location.addressLabel ? (
          <p>
            {data.location.statusLabel ? (
              <span className="store-status">{data.location.statusLabel}</span>
            ) : null}
            {data.location.statusLabel && data.location.addressLabel ? (
              <span className="store-address-separator"> · </span>
            ) : null}
            {data.location.addressLabel ? (
              <span className="store-address">{data.location.addressLabel}</span>
            ) : null}
          </p>
        ) : null}
      </div>
      <div>
        <div className="fulfillment-toggle" aria-label="Fulfillment method">
          {contextLabel ? <strong>{contextLabel}</strong> : <><strong>Delivery</strong><span>Pickup</span></>}
        </div>
        {showMetrics && data.location.fulfillmentSummary?.length ? (
          <dl className="store-metrics" aria-label="Store fulfillment summary">
            {data.location.fulfillmentSummary.map((metric) => (
              <div key={metric.id}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

export function StoreHome({
  data,
  variant,
  searchSlot,
  entryContextSlot,
  fulfillmentMode,
  visualPreset,
}: StoreHomeProps) {
  const isHome = variant === "home";
  const supportsOrdering = variant !== "menu-categories";
  const navigationItems = [
    { id: "menu", label: "Menu", href: "#menu" },
    ...(isHome
      ? [{ id: "store-details", label: "Store details", href: "#store-details" }]
      : []),
  ];
  const rail = supportsOrdering && data.orderRail ? <OrderRail order={data.orderRail} /> : undefined;
  const cartLabel = data.orderRail
    ? `Cart · ${data.orderRail.itemCountLabel} · ${data.orderRail.totalLabel}`
    : "Cart";
  const showContextHeader = variant === "menu-categories" || variant === "full-menu";

  return (
    <StorefrontShell
      header={
        <>
          {showContextHeader && data.location.promotionLabel ? (
            <div className="promotion-banner">{data.location.promotionLabel}</div>
          ) : null}
          <StorefrontHeader
            brand={data.location.name}
            brandHref={isHome ? "#store-details" : "#menu"}
            items={navigationItems}
            addressLabel={data.location.addressLabel}
            cartLabel={cartLabel}
          />
          {isHome ? entryContextSlot : null}
          {variant === "menu-categories" && data.location.sessionContextLabel ? (
            <div className="service-session-bar">
              <span>{data.location.sessionContextLabel}</span>
              {data.location.sessionActionLabel ? (
                <strong>{data.location.sessionActionLabel}</strong>
              ) : null}
            </div>
          ) : null}
        </>
      }
      hero={
        isHome ? (
          visualPreset ? (
            <StorefrontPresetHero data={data} visualPreset={visualPreset} />
          ) : (
            <StoreHero data={data} />
          )
        ) : undefined
      }
      intro={
        isHome && !visualPreset ? (
          <StoreIntro data={data} fulfillmentMode={fulfillmentMode} />
        ) : undefined
      }
      leading={
        variant === "menu-categories" ? undefined : (
          <CategoryNavigation
            categories={data.categories}
            includeFeatured
          />
        )
      }
      rail={rail}
      stickyAction={
        supportsOrdering && data.orderRail ? (
          <Button disabled>
            Cart · {data.orderRail.itemCountLabel} · {data.orderRail.totalLabel}
          </Button>
        ) : undefined
      }
      variant={variant}
      visualPresetId={visualPreset?.id}
    >
      <div className="catalog-column" id="menu">
        {variant === "category-scroll" || variant === "full-menu" ? (
          <h1 className="sr-only">{data.location.name}</h1>
        ) : null}
        {variant === "full-menu" ? <MenuTypeTabs /> : null}
        {supportsOrdering ? searchSlot : null}
        <div className="store-home-browse-content">
          {data.categories.length || data.menuCategories.length ? (
            <BrowseContent data={data} variant={variant} />
          ) : (
            <CatalogPageState kind="empty" />
          )}
        </div>
      </div>
    </StorefrontShell>
  );
}
