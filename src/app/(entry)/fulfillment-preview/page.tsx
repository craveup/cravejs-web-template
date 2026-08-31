import Link from "next/link";
import { notFound } from "next/navigation";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontSkipLink } from "@/components/shell/storefront-skip-link";
import { StoreHome } from "@/features/catalog/browse/store-home";
import { createCatalogSearchIndex } from "@/features/catalog/catalog-types";
import { CatalogSearch } from "@/features/catalog/search/search-results";
import { loadDemoStoreHomeData } from "@/features/catalog/server/load-store-home";
import { EntryBanner } from "@/features/fulfillment/entry/entry-banner";
import { resolveEntryIntent } from "@/features/fulfillment/entry/resolve-entry-intent";
import { StoreList } from "@/features/fulfillment/stores/store-list";
import { OrderTimePicker } from "@/features/fulfillment/time/order-time-picker";
import { ModePicker } from "@/features/fulfillment/mode/mode-picker";
import { DeliveryAddressForm } from "@/features/fulfillment/address/delivery-address-form";
import { SavedAddressesPreview } from "@/features/fulfillment/address/saved-addresses-preview";
import { DeliveryHandoff } from "@/features/fulfillment/address/delivery-handoff";
import { TableConfirmation } from "@/features/fulfillment/details/table-confirmation";
import { RoomForm } from "@/features/fulfillment/details/room-form";
import { themeIds, type ThemeId } from "@/styles/themes";

import styles from "./page.module.css";

const entryScreens = ["E1", "E2", "E3", "S1", "S2", "S3", "S4", "S5", "S7", "S10", "S11", "S13", "S14"] as const;
type EntryScreen = (typeof entryScreens)[number];

function intentFor(screen: EntryScreen) {
  if (screen === "E2") return resolveEntryIntent({ table: "12" }, true);
  if (screen === "E3") return resolveEntryIntent({ room: "324" }, true);
  return resolveEntryIntent({}, true);
}

const previewStores = [
  { id: "downtown", name: "Downtown", addressLabel: "Market Street", enabledModes: ["takeout", "delivery"] as const },
  { id: "riverside", name: "Riverside", addressLabel: "River Road", enabledModes: ["takeout"] as const },
  { id: "airport", name: "Airport", addressLabel: "Terminal Avenue", enabledModes: ["delivery"] as const },
];

const previewTimes = [{
  date: "2026-08-10",
  label: "Today",
  slots: [
    { instant: "2026-08-10T11:30:00-04:00", label: "11:30 AM", orderDate: "2026-08-10", orderTime: "11:30" },
    { instant: "2026-08-10T12:00:00-04:00", label: "12:00 PM", orderDate: "2026-08-10", orderTime: "12:00" },
    { instant: "2026-08-10T12:30:00-04:00", label: "12:30 PM", orderDate: "2026-08-10", orderTime: "12:30", available: false },
  ],
}];

const previewDeliveryPolicy = {
  supportedCountryCodes: ["US"],
  postcodeRequiredCountryCodes: ["US"],
  deliveryRadiusMiles: 5,
  origin: { latitude: 34.0522, longitude: -118.2437 },
  policyLabel: "the preview merchant policy",
};

const previewAddresses = [{
  id: "home",
  revision: 1,
  label: "Home",
  formattedLabel: "1 Example Street, Los Angeles, CA 90010",
  street: "1 Example Street",
  streetOptional: "Apt 4B",
  city: "Los Angeles",
  region: "CA",
  latitude: 34.0525,
  longitude: -118.2435,
  countryCode: "US",
  postcode: "90010",
}];

const previewSavedAddresses = [
  {
    ...previewAddresses[0],
    formattedLabel: "1 Example Street · Apt 4B",
  },
  {
    id: "work",
    revision: 1,
    label: "Work",
    formattedLabel: "1 Example Street · Floor 12",
    street: "1 Example Street",
    streetOptional: "Floor 12",
    city: "Los Angeles",
    region: "CA",
    latitude: 34.0524,
    longitude: -118.2436,
    countryCode: "US",
    postcode: "90010",
  },
];

const previewAddressResults = [
  previewAddresses[0],
  {
    formattedLabel: "5 Example Street, Los Angeles, CA 90012",
    street: "5 Example Street",
    city: "Los Angeles",
    region: "CA",
    latitude: 34.053,
    longitude: -118.243,
    countryCode: "US",
    postcode: "90012",
  },
  {
    formattedLabel: "6 Example Street, Los Angeles, CA 90026",
    street: "6 Example Street",
    city: "Los Angeles",
    region: "CA",
    latitude: 34.0535,
    longitude: -118.2425,
    countryCode: "US",
    postcode: "90026",
  },
];

function PreviewHeader() {
  return (
    <StorefrontHeader
      brand="Your Restaurant"
      brandHref="/demo"
      items={[
        { id: "menu", label: "Menu", href: "/demo" },
        { id: "locations", label: "Locations", href: "/stores" },
      ]}
      cartLabel="Cart"
    />
  );
}

export default async function FulfillmentPreview({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; theme?: string; controls?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const screen = entryScreens.includes(query.screen as EntryScreen)
    ? (query.screen as EntryScreen)
    : "E1";
  const theme = themeIds.includes(query.theme as ThemeId) ? (query.theme as ThemeId) : "base";
  const intent = intentFor(screen);
  const data = await loadDemoStoreHomeData("demo");
  const isEntryScreen = screen === "E1" || screen === "E2" || screen === "E3";
  const screenContent = screen === "S1" ? (
    <StoreList stores={previewStores} />
  ) : screen === "S2" ? (
    <ModePicker locationId="demo" detail={{ mode: "takeout" }} enabledModes={["takeout", "delivery", "table-side", "room-service"]} />
  ) : screen === "S3" ? (
    <OrderTimePicker days={previewTimes} allowAsap selectedInstant="asap" />
  ) : screen === "S4" || screen === "S5" ? (
    <DeliveryAddressForm
      policy={previewDeliveryPolicy}
      initialQuery={screen === "S5" ? "300 N" : undefined}
      initialResults={screen === "S5" ? previewAddressResults : undefined}
    />
  ) : screen === "S7" ? (
    <SavedAddressesPreview
      addresses={previewSavedAddresses}
      policy={previewDeliveryPolicy}
      selectedId="home"
    />
  ) : screen === "S10" ? (
    <OrderTimePicker days={previewTimes} state="closed" />
  ) : screen === "S11" ? (
    <DeliveryHandoff locationId="demo" address={previewAddresses[0]} />
  ) : screen === "S13" ? (
    <TableConfirmation
      initialTableIdentifier="12"
      locationLabel="Your Restaurant · Downtown"
    />
  ) : screen === "S14" ? (
    <RoomForm initialRoomIdentifier="324" />
  ) : (
    <StoreHome
      data={data}
      variant="home"
      searchSlot={<CatalogSearch index={createCatalogSearchIndex(data)} />}
      entryContextSlot={<EntryBanner intent={intent} locationId="demo" />}
      fulfillmentMode={intent.kind === "invalid" ? "takeout" : intent.detail.mode}
    />
  );

  return (
    <div className="theme-preview-root" data-theme={theme}>
      <div className={styles.notice}>DESIGN PREVIEW — NO LIVE ORDERS</div>
      {query.controls !== "0" ? (
        <nav className="preview-toolbar" aria-label="Fulfillment design preview">
          {entryScreens.map((value) => (
            <Link
              key={value}
              href={`/fulfillment-preview?screen=${value}&theme=${theme}`}
              aria-current={screen === value ? "page" : undefined}
            >
              {value}
            </Link>
          ))}
        </nav>
      ) : null}
      {!isEntryScreen ? (
        <>
          <StorefrontSkipLink />
          <PreviewHeader />
          <div id="storefront-main" tabIndex={-1}>
            {screenContent}
          </div>
        </>
      ) : screenContent}
    </div>
  );
}
