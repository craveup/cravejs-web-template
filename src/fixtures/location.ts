import type { StorefrontLocation } from "@craveup/storefront-sdk";

export const fixtureLocation = {
  id: "demo",
  restaurantSlug: "fixture-base",
  restaurantDisplayName: "Your Restaurant",
  restaurantBio: "Made-to-order favorites served all day.",
  coverPhoto: "/assets/template/storefront-hero.svg",
  restaurantLogo: "",
  addressData: {
    street: "1 Example Street",
    streetOptional: "",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90012",
    country: "United States",
    lat: 34.0522,
    lng: -118.2437,
  },
  addressString: "1 Example Street, Los Angeles",
} satisfies StorefrontLocation;
