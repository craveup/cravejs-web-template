import type {
  MerchantApiResponse,
  MerchantLocation,
} from "@craveup/storefront-sdk";

export const fixtureMerchantLocation = {
  id: "demo",
  restaurantDisplayName: "Your Restaurant",
  coverPhoto: "/assets/template/storefront-hero.svg",
  restaurantLogo: "",
  addressString: "1 Example Street, Los Angeles",
  restaurantBio: "Made-to-order favorites served all day.",
  lat: 34.0522,
  lng: -118.2437,
  methodsStatus: {
    pickup: true,
    table: true,
    delivery: true,
    roomService: true,
  },
} satisfies MerchantLocation;

export const fixtureMerchant = {
  id: "fixture-merchant",
  name: "Your Restaurant",
  country: "United States",
  currency: "usd",
  bio: "Made-to-order favorites served all day.",
  logo: "",
  cover: "/assets/template/storefront-hero.svg",
  locations: [fixtureMerchantLocation],
} satisfies MerchantApiResponse;
