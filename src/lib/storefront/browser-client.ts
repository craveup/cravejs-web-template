"use client";

import {
  createStorefrontClient,
  type StorefrontSessionStore,
} from "@craveup/storefront-sdk";

import { getCustomerToken } from "./customer-session";
import { resolveStorefrontApiBaseUrl } from "./config";
import { createStorefrontCheckoutActions } from "./checkout-actions";
import {
  browserCartSessionStore,
  createMerchantCartSessionStore,
} from "./session-store";

export interface BrowserStorefrontClientOptions {
  readonly getAuthToken?: () => string | null;
  readonly sessionStore?: StorefrontSessionStore;
}

export function createBrowserStorefrontClient(
  options: BrowserStorefrontClientOptions = {},
) {
  return createStorefrontClient({
    baseUrl: resolveStorefrontApiBaseUrl(
      process.env.NEXT_PUBLIC_CRAVEUP_API_URL,
    ),
    getAuthToken: options.getAuthToken ?? getCustomerToken,
    sessionStore: options.sessionStore ?? browserCartSessionStore,
  });
}

export function createBrowserStorefrontCheckoutActions(merchantSlug: string) {
  const sessionStore = createMerchantCartSessionStore(merchantSlug);
  const client = createBrowserStorefrontClient({ sessionStore });
  return createStorefrontCheckoutActions(client, merchantSlug, sessionStore);
}

export const storefrontClient = createBrowserStorefrontClient();
