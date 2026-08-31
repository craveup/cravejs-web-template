import type { StorefrontCustomerTransportLoader } from "@/lib/storefront/use-customer";

let fixtureCustomerTransportPromise: ReturnType<
  StorefrontCustomerTransportLoader
> | null = null;

export function loadFixtureCustomerTransport() {
  fixtureCustomerTransportPromise ??= import(
    "@/fixtures/customer-transport"
  ).then(({ getFixtureCustomerTransport }) =>
    getFixtureCustomerTransport(),
  );
  return fixtureCustomerTransportPromise;
}
