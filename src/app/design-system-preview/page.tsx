import Link from "next/link";
import { notFound } from "next/navigation";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { StoreHome } from "@/features/catalog/browse/store-home";
import { CatalogPageState } from "@/features/catalog/browse/catalog-page-state";
import {
  createCatalogSearchIndex,
  type StoreHomeVariant,
} from "@/features/catalog/catalog-types";
import { CatalogSearch } from "@/features/catalog/search/search-results";
import { FixtureNewsletterSignup } from "@/features/catalog/content/fixture-newsletter-signup";
import { StorefrontLongForm } from "@/features/catalog/content/storefront-content";
import { createStorefrontLongFormData } from "@/features/catalog/content/storefront-long-form-data";
import { ItemSheetPreview } from "@/features/catalog/product/item-sheet-preview";
import { ItemDetailResourceState } from "@/features/catalog/product/item-detail-resource-state";
import type { ItemDetailView } from "@/features/catalog/product/item-types";
import { fixtureCatalogSource } from "@/features/catalog/server/catalog-source";
import { loadDemoStoreHomeData } from "@/features/catalog/server/load-store-home";
import { fixturePickupCart } from "@/fixtures/cart";
import {
  readFixtureRuntimeFromEnvironment,
  resolveFixtureRuntime,
} from "@/fixtures/fixture-runtime";
import type { FixtureNewsletterScenario } from "@/fixtures/newsletter-resource";
import { themeIds, type ThemeId } from "@/styles/themes";
import { baseStorefrontLongFormContent } from "@/content/storefront-long-form";
import {
  isStorefrontPresetId,
  resolveStorefrontPreset,
  storefrontPresetIds,
} from "@/presets/storefront-presets";

export const dynamic = "force-dynamic";

const variants: StoreHomeVariant[] = [
  "home",
  "category-scroll",
  "menu-categories",
  "full-menu",
];

const itemStates = ["required", "selected", "added", "sold-out"] as const;
type ItemPreviewState = (typeof itemStates)[number];
const newsletterScenarios = [
  "success",
  "invalid",
  "rate-limited",
  "unavailable",
] as const satisfies readonly FixtureNewsletterScenario[];

interface PreviewPageProps {
  searchParams: Promise<{
    variant?: string;
    preset?: string | string[];
    q?: string | string[];
    theme?: string;
    controls?: string;
    itemState?: string;
    itemError?: string;
    itemView?: string;
    longForm?: string;
    newsletterScenario?: string;
    catalogState?: string;
  }>;
}

function prepareItemPreview(item: ItemDetailView, state: ItemPreviewState) {
  const preview = structuredClone(item);
  if (state === "sold-out") {
    preview.availability = "sold-out";
    preview.unavailableMessage = "This item is unavailable right now.";
    return preview;
  }
  if (state === "selected") {
    const side = preview.modifierGroups.find((group) => group.id === "choose-a-side");
    const extras = preview.modifierGroups.find((group) => group.id === "add-extras");
    const fries = side?.options.find((option) => option.id === "crinkle-fries");
    const patty = extras?.options.find((option) => option.id === "extra-patty");
    if (fries) fries.defaultQuantity = 1;
    if (patty) patty.defaultQuantity = 1;
  }
  return preview;
}

export default async function DesignSystemPreview({ searchParams }: PreviewPageProps) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DESIGN_SYSTEM_PREVIEW !== "1"
  ) {
    notFound();
  }

  const query = await searchParams;
  const variant = variants.includes(query.variant as StoreHomeVariant)
    ? (query.variant as StoreHomeVariant)
    : "home";
  const initialQuery = Array.isArray(query.q) ? query.q[0] : query.q;
  const visualPreset = isStorefrontPresetId(query.preset)
    ? resolveStorefrontPreset(query.preset)
    : undefined;
  const theme = themeIds.includes(query.theme as ThemeId)
    ? (query.theme as ThemeId)
    : visualPreset?.defaultThemeId ?? "base";
  const data = await loadDemoStoreHomeData("demo");
  const itemState = itemStates.includes(query.itemState as ItemPreviewState)
    ? (query.itemState as ItemPreviewState)
    : undefined;
  const itemView = query.itemView;
  const visualServerEvidence = {
    "data-fixture-profile": process.env.STOREFRONT_PROFILE,
    "data-visual-server-nonce": process.env.PLAYWRIGHT_SERVER_NONCE,
  };

  if (query.catalogState === "loading") {
    return (
      <div className="theme-preview-root" data-theme={theme} {...visualServerEvidence}>
        <StorefrontShell
          header={
            <StorefrontHeader
              brand={data.location.name}
              items={[{ id: "menu", label: "Menu", href: "#menu" }]}
            />
          }
        >
          <CatalogPageState kind="loading" />
        </StorefrontShell>
      </div>
    );
  }

  if (query.longForm === "1") {
    const runtime =
      readFixtureRuntimeFromEnvironment() ??
      resolveFixtureRuntime(
        { profile: "hosted-multitenant", tenant: "fixture-base" },
        "development",
      );
    const scenario = newsletterScenarios.includes(
      query.newsletterScenario as FixtureNewsletterScenario,
    )
      ? (query.newsletterScenario as FixtureNewsletterScenario)
      : "success";
    return (
      <div className="theme-preview-root" data-theme={theme} {...visualServerEvidence}>
        <StorefrontLongForm
          content={baseStorefrontLongFormContent}
          data={createStorefrontLongFormData(
            data,
            baseStorefrontLongFormContent,
          )}
          newsletter={
            query.newsletterScenario !== "none" && runtime.config.newsletter
              ? (
                  <FixtureNewsletterSignup
                    copy={runtime.config.newsletter}
                    locale={runtime.config.locale}
                    runtime={runtime}
                    scenario={scenario}
                  />
                )
              : undefined
          }
        />
      </div>
    );
  }

  if (itemState || itemView) {
    const detail = await fixtureCatalogSource.products.get("demo", "double-smash-burger");
    if (!detail) notFound();
    const similarItems = data.categories
      .find((category) => category.id === "burgers")
      ?.items.filter((item) => item.id !== detail.id && item.availability === "available")
      .slice(0, 2) ?? [];
    const recommendations = data.categories
      .flatMap((category) => category.items)
      .filter((item) => item.id !== detail.id && item.availability === "available")
      .slice(0, 3);

    return (
      <>
        {query.controls !== "0" ? (
          <nav className="preview-toolbar" aria-label="Item state preview">
            {itemStates.map((value) => (
              <Link
                href={`/design-system-preview?itemState=${value}&theme=${theme}`}
                aria-current={itemState === value ? "page" : undefined}
                key={value}
              >
                {value}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="theme-preview-root" data-theme={theme} {...visualServerEvidence}>
          <StorefrontShell
            variant="item"
            header={
              <StorefrontHeader
                brand={data.location.name}
                brandHref="/demo#menu"
                items={[{ id: "menu", label: "Menu", href: "/demo#menu" }]}
                cartLabel="Cart"
              />
            }
          >
            {itemView === "loading" ? (
              <ItemDetailResourceState
                state={{ status: "loading" }}
                menuHref="/demo#menu"
              />
            ) : itemView === "error" ? (
              <ItemDetailResourceState
                state={{ status: "error", message: "Please try again." }}
                menuHref="/demo#menu"
              />
            ) : itemView === "not-found" ? (
              <ItemDetailResourceState
                state={{ status: "not-found" }}
                menuHref="/demo#menu"
              />
            ) : (
              <ItemSheetPreview
                item={prepareItemPreview(detail, itemState ?? "selected")}
                similarItems={similarItems}
                recommendations={recommendations}
                addedCart={itemState === "added" ? fixturePickupCart : undefined}
                groupError={
                  query.itemError === "group"
                    ? {
                        modifierGroupId: "choose-a-side",
                        message: "Choose a side.",
                      }
                    : undefined
                }
                cartFeedback={
                  itemView === "conflict"
                    ? {
                        status: "retry-required",
                        message: "Your order changed. Review it and retry this item.",
                      }
                    : itemView === "retryable"
                      ? {
                          status: "retryable",
                          message: "Ordering is temporarily unavailable. Try again shortly.",
                          retryAfterSeconds: 2,
                        }
                      : itemView === "unavailable"
                        ? { status: "unavailable" }
                        : itemView === "terminal"
                          ? {
                              status: "error",
                              message: "Ordering cannot continue for this item.",
                            }
                        : undefined
                }
              />
            )}
          </StorefrontShell>
        </div>
      </>
    );
  }

  return (
    <>
      {query.controls !== "0" ? (
        <>
          <nav className="preview-toolbar" aria-label="Storefront concept preview">
            {storefrontPresetIds.map((presetId) => {
              const preset = resolveStorefrontPreset(presetId);
              return (
                <Link
                  href={`/design-system-preview?preset=${preset.id}`}
                  aria-current={visualPreset?.id === preset.id ? "page" : undefined}
                  key={preset.id}
                >
                  {preset.name}
                </Link>
              );
            })}
          </nav>
          <nav className="preview-toolbar" aria-label="Store home layout preview">
            {variants.map((value) => (
              <Link
                href={`/design-system-preview?variant=${value}&theme=${theme}${visualPreset ? `&preset=${visualPreset.id}` : ""}`}
                aria-current={variant === value ? "page" : undefined}
                key={value}
              >
                {value}
              </Link>
            ))}
          </nav>
        </>
      ) : null}
      <div className="theme-preview-root" data-theme={theme} {...visualServerEvidence}>
        <StoreHome
          data={data}
          variant={variant}
          visualPreset={visualPreset}
          searchSlot={
            <CatalogSearch
              index={createCatalogSearchIndex(data)}
              initialQuery={initialQuery}
            />
          }
        />
      </div>
    </>
  );
}
