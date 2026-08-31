# Standalone Configuration

The standalone storefront reads one validated public configuration. It never imports the hosted
tenant registry, accepts tenant authority from a URL, or falls back to fixtures in production.

## Environment

The generated `.env.example` contains these public settings:

- `NEXT_PUBLIC_CRAVEUP_API_URL`: exact public API origin. It must equal `apiBaseUrl`; the SDK adds
  `/api/v1/storefront`.
- `STOREFRONT_PROFILE`: always `standalone-cli` for this project.
- `STOREFRONT_STANDALONE_CONFIG_JSON`: one validated standalone project configuration.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: optional browser key restricted by exact domain and required
  Google Maps APIs when delivery address search is enabled.
- `STOREFRONT_DELIVERY_RADIUS_MILES`: optional positive storefront delivery-radius policy; the
  default is five miles.

These values are public application configuration, not working credentials. Never add Crave API
keys, cart or receipt capabilities, customer sessions, checkout handoff values, idempotency values,
or provider secrets.

## Standalone Config Fields

| Field | Requirement |
|---|---|
| `profile` | Exact `standalone-cli`. |
| `projectId` | Immutable RFC 4122 UUID created once by the future external CLI. |
| `tenantId` | Exact `standalone:${projectId}` namespace derived from the project ID. |
| `merchantSlug` | Lowercase URL-safe merchant slug. |
| `canonicalOrigin` | Exact application origin; HTTPS in production. |
| `apiBaseUrl` | Exact public Storefront API origin; HTTPS in production. |
| `assetOrigins` | Unique exact HTTPS origins; an empty array is valid. |
| `checkoutOrigins` | One or more exact HTTPS hosted-checkout origins. |
| `themeId` | One generated theme: `base`, `ember`, `hearth`, `meadow`, `noir`, or `signal`. |
| `locale` | Valid BCP 47 locale used for presentation. |
| `timeZone` | Valid IANA merchant timezone. |
| `templateRelease` | Exact semantic template version, never a range. |
| `configSchemaVersion` | Exact schema version supported by the release. |
| `capabilities.loyalty` | Public boolean intersected with the merchant/API capability. |
| `newsletter` | `null` or the approved public five-field copy object. |

Newsletter copy contains only `heading`, `emailLabel`, `submitLabel`, `consentCopy`, and
`successMessage`. It contains no endpoint, provider detail, submitted email, credential, or tenant
authority.

## Validation Behavior

Origins must contain no credentials, wildcard hosts, paths, queries, or fragments. Production
origins use HTTPS. The browser API origin and resolved `apiBaseUrl` must match exactly. Invalid or
missing configuration stops startup/build with a safe development error and never selects a demo
merchant.

The external CLI is not implemented yet. This content describes the approved generated-project
contract and is not a manual substitute for project generation or provenance.
