"use client";

import useSWR from "swr";

import { resolveStorefrontApiBaseUrl } from "./config";
import {
  StorefrontCatalogReadError,
  createStorefrontCatalogReader,
  type StorefrontCatalogReader,
  type StorefrontProductDetail,
} from "./catalog";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";
import { getActiveStorefrontMerchant } from "./session-store";

export type StorefrontProductDetailResource =
  | { readonly status: "loading" }
  | { readonly status: "not-found"; readonly retry: () => Promise<unknown> }
  | {
      readonly status: "error";
      readonly error: StorefrontErrorState;
      readonly retry: () => Promise<unknown>;
    }
  | {
      readonly status: "ready";
      readonly data: StorefrontProductDetail;
      readonly refreshing: boolean;
      readonly refreshError?: StorefrontErrorState;
      readonly retry: () => Promise<unknown>;
    };

export interface UseStorefrontProductDetailOptions {
  readonly enabled?: boolean;
  readonly cacheScope?: string;
  readonly reader?: Pick<StorefrontCatalogReader, "products">;
}

const liveProductReader: Pick<StorefrontCatalogReader, "products"> = {
  products: {
    async get(locationId, productId) {
      const { storefrontClient } = await import("./browser-client");
      return createStorefrontCatalogReader(storefrontClient).products.get(
        locationId,
        productId,
      );
    },
  },
};

function liveCacheScope(): string {
  const apiOrigin = resolveStorefrontApiBaseUrl();
  const merchant = getActiveStorefrontMerchant() ?? "anonymous";
  return `${apiOrigin}|${merchant}`;
}

function safeError(error: unknown): StorefrontErrorState {
  if (error instanceof StorefrontCatalogReadError) {
    return {
      state: error.state,
      code: error.code,
      message: error.message,
      requestId: error.requestId,
      details: error.details,
      retryAfterMs: error.retryAfterMs,
      method: error.method,
      routeTemplate: error.routeTemplate,
    };
  }
  return toStorefrontErrorState(error);
}

export function useStorefrontProductDetail(
  locationId: string,
  productId: string,
  {
    enabled = true,
    cacheScope,
    reader = liveProductReader,
  }: UseStorefrontProductDetailOptions = {},
): StorefrontProductDetailResource {
  const scope = enabled ? (cacheScope ?? liveCacheScope()) : "disabled";
  const resource = useSWR(
    enabled
      ? ["storefront-product-detail", scope, locationId, productId]
      : null,
    () => reader.products.get(locationId, productId),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );
  const retry = () => resource.mutate();

  if (!enabled || resource.isLoading) return { status: "loading" };
  if (resource.data) {
    return {
      status: "ready",
      data: resource.data,
      refreshing: resource.isValidating,
      ...(resource.error ? { refreshError: safeError(resource.error) } : {}),
      retry,
    };
  }
  if (resource.error) {
    return { status: "error", error: safeError(resource.error), retry };
  }
  return { status: "not-found", retry };
}
