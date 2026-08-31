import type { ResolvedStorefrontConfig } from "../../config/storefront-config";

export interface TenantResolutionRequest {
  host: string;
  pathname: string;
}

export interface TenantResolver {
  resolve(
    request: TenantResolutionRequest,
  ): Promise<ResolvedStorefrontConfig | null>;
}

export interface HostedTenantRegistry {
  getByHost(host: string): Promise<unknown | null>;
}
