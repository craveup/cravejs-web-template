export interface StorefrontCustomerScopeAdapter {
  readonly setMerchantScope: (merchantSlug: string) => void;
}

let storefrontCustomerScopeQueue: Promise<void> = Promise.resolve();

export function runInStorefrontCustomerScope<T>(
  adapter: StorefrontCustomerScopeAdapter,
  merchantSlug: string,
  operation: () => Promise<T> | T,
): Promise<T> {
  const result = storefrontCustomerScopeQueue
    .catch(() => undefined)
    .then(async () => {
      adapter.setMerchantScope(merchantSlug);
      return await operation();
    });

  storefrontCustomerScopeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
