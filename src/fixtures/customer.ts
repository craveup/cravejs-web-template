import type {
  CursorPage,
  CustomerAddress,
  CustomerLoginResponse,
  SavedPaymentMethod,
  StorefrontCustomer,
} from "@craveup/storefront-sdk";

import { fixtureTimeline } from "./reference-now";

export const fixtureCustomer = {
  id: "fixture-customer-1",
  profilePicture: "",
  customerEmail: "customer.fixture@example.test",
  customerName: "Sam",
  lastName: "Lee",
  phoneNumber: "+1 555 000 0000",
} satisfies StorefrontCustomer;

export const fixtureCustomerChallenge = {
  methodId: "fixture-email-method",
  delivery: "email",
} satisfies CustomerLoginResponse;

export const fixtureSavedAddresses = {
  items: [
    {
      addressId: "fixture-address-home",
      fullAddress: "1 Example Street, Los Angeles, CA 90012",
      line1: "1 Example Street",
      line2: "",
      line3: "Los Angeles, CA 90012",
      lat: 34.0522,
      lng: -118.2437,
      revision: 3,
      createdAt: fixtureTimeline.addressCreatedAt,
    },
    {
      addressId: "fixture-address-office",
      fullAddress: "2 Example Avenue, Los Angeles, CA 90013",
      line1: "2 Example Avenue",
      line2: "Suite 200",
      line3: "Los Angeles, CA 90013",
      lat: 34.0498,
      lng: -118.2468,
      revision: 1,
      createdAt: fixtureTimeline.addressCreatedAt,
    },
  ],
  nextCursor: null,
} satisfies CursorPage<CustomerAddress>;

export const fixtureSavedPayments = [
  {
    id: "fixture-payment-visa",
    brand: "visa",
    displayBrand: "Visa",
    expMonth: 12,
    expYear: 2030,
    last4: "4242",
  },
] satisfies SavedPaymentMethod[];
