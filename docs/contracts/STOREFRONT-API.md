# Storefront API Consumer Contract

- **Audience:** Developers implementing this template without access to Crave API repositories
- **Contract date:** 2026-08-11
- **Public source/API/docs commit:** `4c9a7763237dee3bcfaaf433275b84968655d1a4`
- **Public npm release verified:** `2.0.1` on 2026-08-11 with SRI
  `sha512-dqvAtGf9+0ZVbG57iDAXNs4HAy+N37u9bmx5+y8KFFsVxOkvrPP5rhrLv7BBKvLosdhooi8YRAQsWCW9xxuJog==`
- **Staging Swagger verified:** 15 paths, SHA-256
  `37511eeefdb396d5e0768ce3a37c4d3e6ce60f2fdaa5cf340a3d2b400f7af05b`; incomplete and rejected
- **Required SDK:** `@craveup/storefront-sdk@2.0.1`
- **Deployed API SHA identified:** `52cac07f74f1b8ca9a931354240560ef9beb4dce`
- **Byte-exact generated OpenAPI SHA-256:**
  `9ba30418162695c27842ba6085ba00510c867137ecf83df0fe55b7808762a0d7`
- **Current readiness:** exact package/source identity and anonymous staging reads are available;
  complete OpenAPI/baseline, all-mode fixtures/smoke, exact checkout origins, and safe consumer
  return/result evidence remain incomplete

The previous source review stopped at `28d1a9ec10b998b8ef139f98da04d11ee926babe`. The reviewed delta
through `3050c920b6212d591e90aaea0e4472725cbb0600` includes server support for edge-weakened
revision tags at `11ae0274c828eb6c83fb49fa722445e5244ee324` and matching SDK parsing at
`a417d4d0f6ea8e0df01a82d6c710908bdce13b68`. Those fixes confirm that application code must treat
ETags as SDK-owned protocol data.

The subsequent source delta through `14dc516e0cf34640d8c537b4f13e0c66be6771a1` adds claim and cart-
reuse revision behavior at `3f5fd896d19f60584393b5faa36331ae56797e48`, then persists explicitly
recovered carts at `9811e66d2c1a7da10e245180424000ce48af5e13`.
The public `2.0.1` artifact provides the reviewed consumer surface and the handoff records its public
source/API/docs commit above. This does not by itself satisfy full Gate 0 or authorize access to a
private project.

This document is the developer-facing contract. Private Crave controller, model, route, or database
files are deliberately not prerequisites. If this document, the pinned SDK types, and the committed
OpenAPI export disagree, stop integration and ask the platform owner to publish one corrected
baseline. Do not inspect or guess private implementation details.

This transport contract applies identically to `hosted-multitenant` and `standalone-cli`. Profile
selection, tenant resolution, metadata/theme, deployment, and generation live outside SDK feature
methods. Hosted production resolves merchant/config from its trusted host registry and rejects URL
overrides; standalone uses validated generated config. Neither profile broadens this contract or
adds an API key.

## New-template evolution and durable platform contracts

This new web template/application has not shipped. It may replace only its own Crave-owned consumer
behavior, configuration, routes, components, operations, or fields proven never deployed and never
published. Inside that proven scope, add no legacy route alias or fallback, compatibility shim, dual
SDK path, profile-specific client, or old/new configuration reader. Replace all in-scope callers and
remove the obsolete template route, method, schema, or adapter in the same bounded change.

The new template rejects and does not adapt SDK 1.x. It must not install `1.0.3` or add a 1.x adapter.
That consumer choice does not delete or unpublish the published artifact and does not authorize
silently breaking deployed `/api/v1` behavior. Currently deployed hosted storefront and API behavior,
plus every published SDK or package artifact, are durable compatibility obligations. Published-artifact
safety does not depend on finding known external consumers.

In-place breaking changes are permitted only for operations or fields proven never deployed and never
published. Otherwise evolve through additive versioning or a new contract, migration, and operational
cutover/rollback gate with an owner, compatibility window, acceptance evidence, and rollback proof.
External provider contracts and persisted approved data remain durable boundaries. One logical SDK
client layer supplies its required server/browser instances to both profiles, and both profiles consume
the same feature core.

## Do not install SDK 1.x

The public npm release `1.0.3` is the retired API-key client. It accepts a browser API key, exposes
legacy routes, and does not implement capability/revision/idempotency behavior. It must never appear
in this repository's lockfile or client bundle.

Gate 0 pins exactly `2.0.1`. A later version requires an explicit contract-update PR; do not use a
caret range for the first release.

## Runtime configuration

| Variable | Exposure | Required | Purpose |
|---|---|---:|---|
| `STOREFRONT_PROFILE` | server, public config | yes | Exact `hosted-multitenant` or `standalone-cli` bootstrap selection |
| `STOREFRONT_HOSTED_TENANTS_JSON` | server, public config | hosted only | Trusted exact-host to validated tenant-config registry; never browser-exposed |
| `STOREFRONT_STANDALONE_CONFIG_JSON` | server, public config | standalone only | One validated immutable generated-project config; never reads the hosted registry |
| `NEXT_PUBLIC_CRAVEUP_API_URL` | public | yes | Explicit public API origin; must equal resolved `apiBaseUrl`; the SDK adds `/api/v1/storefront` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | public, domain/API restricted | delivery | Google Places/maps browser integration |
| `STOREFRONT_DELIVERY_RADIUS_MILES` | server, non-secret | no | Positive template/merchant delivery-radius policy; defaults to `5` miles and is always labeled as storefront policy, not API serviceability |
| `FIGMA_TOKEN` | local shell only | design checks | Read-only design snapshot tooling; never CI or `.env.local` |

There is no `CRAVE_API_KEY`, `NEXT_PUBLIC_CRAVEUP_API_KEY`, `STRIPE_SECRET_KEY`, cart token, receipt
token, customer JWT, or provider secret in environment configuration.

Resolved profile config also contains public `checkoutOrigins: readonly string[]`; the standalone CLI
generates it and the hosted registry supplies it. These exact HTTPS origins are not secrets and are
never inferred from a prepare response. There is no Stripe/provider configuration in this consumer.
Merchant, canonical origin, theme, locale, timezone, assets, checkout origins, and capabilities come
only from the validated selected profile config. URL/query overrides and merchant-only production
fallbacks are rejected.

Remote merchant/catalog images are restricted by exact Next.js `images.remotePatterns` committed at
Gate 0 from the baseline's `assetOrigins`. An honest empty array is valid and produces no remote
patterns. Do not use wildcards or inherit demo/private-project hosts. An origin change requires a
contract-baseline PR and a negative-host image test.

## Client construction

Create one profile-neutral SDK client layer with exactly two runtime-specific instances behind
repository-owned modules:

```ts
// src/lib/storefront/server-client.ts
import "server-only";
import { createStorefrontClient } from "@craveup/storefront-sdk";

export const storefrontServerClient = createStorefrontClient({
  baseUrl: process.env.NEXT_PUBLIC_CRAVEUP_API_URL!,
});
```

```ts
// src/lib/storefront/browser-client.ts
import { createStorefrontClient } from "@craveup/storefront-sdk";
import { getCustomerToken } from "./customer-session";
import { browserCartSessionStore } from "./session-store";

export const storefrontClient = createStorefrontClient({
  baseUrl: process.env.NEXT_PUBLIC_CRAVEUP_API_URL!,
  getAuthToken: getCustomerToken,
  sessionStore: browserCartSessionStore,
});
```

Components do not instantiate SDK clients and do not call raw Storefront API URLs. Server pages use
the server client. Client hooks/actions use the browser client. Neither instance is duplicated for a
hosted or standalone profile.

## Authorization and state

### Anonymous reads

Published merchant, location, menu, and product reads need no credential. Server Components may
cache them according to the page's freshness policy. SDK 2.0.1 must force `auth: false` for these
methods: a browser client with a customer-token callback must not attach that JWT to an anonymous
read. Gate 0 tests this with a sentinel token and rejects any request carrying `Authorization`.

### Guest cart capability

Starting an ordering session returns a cart and, for a new guest cart, a purpose-limited capability.
The SDK persists this through a caller-owned store:

```ts
export interface StorefrontCartSession {
  cartId: string;
  locationId: string;
  accessToken?: string;
  merchantSlug?: string;
  revision: number;
}
```

Use versioned `sessionStorage`, keyed by merchant and location. Reject malformed/unknown versions and
clear expired, completed, or irrecoverably forbidden sessions. Never use localStorage, cookies, query
parameters, server props, logs, analytics metadata, or error telemetry for cart capabilities.

### Existing-cart recovery and customer claim

When recovery knows an `existingCartId` but the local cart record is absent, call
`orderingSessions.start(locationId, { existingCartId, ... }, { revision })` with the explicit numeric
revision last received from an authoritative response. The SDK constructs `If-Match`; application code
does not build the header. It sends no `X-Cart-Token` unless the session store already holds a valid
capability for that exact location/cart.

After successful recovery, persist the returned `locationId`, `cartId`, and authoritative ETag/cart
revision even when no guest capability exists. Never invent a capability. If the API returns a new
capability, store it only in the exact merchant/location session scope.

A signed-in capability holder may claim a guest cart even if the cart has a reporting-only inferred
customer assignment. After successful claim, persist the returned cart/revision, remove the now-revoked
guest capability, and authorize later cart reads/mutations with the merchant-bound customer JWT. Claim
tests cover restart, wrong merchant/customer, stale revision, and absence of `X-Cart-Token` afterward.

### Customer session

OTP login is merchant-bound. The customer JWT is sent only as `Authorization: Bearer`. Keep it
tab-scoped, clear it on logout/401, and never attach it to an anonymous call when the SDK marks the
request `auth: false`.

### Receipt capability

Receipt links carry a short-lived capability in the URL fragment. On page load:

1. read `receiptToken` from the fragment;
2. remove the fragment with `history.replaceState` before any analytics/navigation;
3. retain the token only in sessionStorage under that receipt id; and
4. send it only as `X-Receipt-Token` through `storefront.receipts.get`.

### Revisions and idempotency

Cart mutations require the stored revision and a unique idempotency key. The SDK sends
`X-Cart-Token`, `If-Match: "cart-{revision}"`, and `Idempotency-Key`, then stores the returned ETag
revision. It accepts the reviewed strong or edge-weakened representation and exposes only the parsed
revision to application code; components and feature actions never parse or construct ETags.

On `CART_CONFLICT`, the SDK refreshes the revision but does not replay the mutation. The UI must show
the refreshed cart and ask the customer to retry. A caller-stable idempotency key is used only when
the application is deliberately retrying the exact same logical operation.

For a lost response or timeout, a deliberate transport retry reuses the original idempotency key
and identical payload. This is especially important for `cart.delete`: keep the key until the server
replays the terminal deletion result, then clear the scoped cart session. A new key or changed
payload is a new action, not a retry. Never loop automatically on `IDEMPOTENCY_IN_PROGRESS`.

## SDK method matrix

All paths below are relative to `/api/v1/storefront`. Application code calls the SDK method, not the
path.

| Capability | SDK method | Authorization | Consumer rule |
|---|---|---|---|
| Merchant and locations | `merchant.getBySlug(slug)` | anonymous | Source for merchant identity, location list, currency, and enabled modes |
| Location detail | `locations.getById(locationId)` | anonymous | Branding/address detail; do not invent hours or fees |
| Distance | `locations.distance(locationId, {lat,lng,unit})` | anonymous | Bound concurrency for store lists; no per-keystroke calls |
| Order times | `locations.getOrderTimes(locationId)` | anonymous | Server-provided days and instant slots; never pair adjacent slots into ranges |
| Gratuity config | `locations.getGratuity(locationId)` | anonymous | Uses `defaultTipPercentage`; custom display follows returned rules |
| Menu bundle | `menus.list(locationId, params)` | anonymous | `menuOnly:true` is first-paint fallback; normal reads pass order date/time |
| Product detail | `products.get(locationId, productId)` | anonymous | Source for nested modifiers and nutrition |
| Start/resume session | `orderingSessions.start(locationId, payload, config)` | optional cart/customer | Recovery supplies `existingCartId` plus explicit numeric `revision`; SDK persists the returned cart/revision |
| Read cart | `cart.get(locationId, cartId)` | cart capability or owner JWT | Authoritative cart/revision/totals |
| Update cart | `cart.update(locationId, cartId, payload)` | cart + revision | Use only fields documented by SDK/OpenAPI |
| Abandon/delete cart | `cart.delete(locationId, cartId, config)` | cart + revision + idempotency | Retry a lost response only with the same key/body; clear the scoped session after terminal success |
| Add item | `cart.addItem(...)` | cart + revision + idempotency | Nested selections use SDK types |
| Quantity | `cart.updateItemQuantity(...)` | cart + revision + idempotency | Direct quantity edit exists; modifier replacement does not |
| Remove item | `cart.removeItem(...)` | cart + revision + idempotency | Do not emulate deletion with quantity zero |
| Fulfillment detail | `cart.setDelivery`, `cart.setTable`, `cart.setRoom` | cart + revision + idempotency | Persist mode-specific details before checkout handoff |
| Order time | `cart.updateOrderTime(...)` | cart + revision + idempotency | Refetch/render returned cart |
| Tip | `cart.updateGratuity(...)` | cart + revision + idempotency | Send returned percentage/amount semantics; never derive totals |
| Discount | `cart.applyDiscount`, `cart.removeDiscount` | cart + revision + idempotency | Render server totals and typed errors |
| Claim cart | `cart.claim(...)` | capability + customer JWT | SDK persists returned revision, removes the guest capability, then uses customer JWT |
| OTP request | `customer.login({merchantSlug, identifierString})` | anonymous | Response includes typed `methodId`; no customer name is required here |
| OTP verify | `customer.verifyOtp({merchantSlug, identifierString, methodId, otp, ...name})` | anonymous | Persist returned customer JWT for the current tab |
| Profile/logout | `customer.getProfile`, `customer.logout` | customer JWT | Clear local session on logout or unauthorized response |
| Orders | `customer.orders.list/get` | customer JWT | Cursor pagination; order detail is sanitized for customers |
| Addresses | `customer.addresses.list/create/update/delete` | customer JWT | Updates use address revisions; mutations are idempotent |
| Saved payments | `customer.savedPayments.list/delete` | customer JWT | Render provider-sanitized metadata only |
| Hosted handoff | `checkout.prepare(locationId, cartId, {idempotencyKey})` | cart + revision | Validate `{checkoutUrl, expiresAt}` against exact profile `checkoutOrigins`, preserve the URL as opaque, and top-level navigate |
| Order result | `checkout.getOrderResult(...)` | cart/owner | Use only after a released safe consumer return/result contract supplies the required context; navigation is not success |
| Receipt | `receipts.get(receiptId, {receiptToken})` | receipt capability or owner JWT | Token is call-scoped and tab-scoped |
| Rating | `ratings.submit(...)` | cart/owner + idempotency | Only after a completed order result |
| Loyalty | `loyalty.quote/redeem/cancel/ledger/claims` | cart or customer as method requires | Treat provider unavailability as a visible optional-feature state |
| Analytics | `analyticsEvents.track(...)` | cart capability/owner when cart-scoped | Client may emit only SDK-approved event types; never send tokens or sensitive data |

This template never calls `checkout.createPaymentIntent` or `checkout.exchange`. Hosted checkout
owns exchange, payment collection, cards/wallets, challenges/declines, and terminal payment UI. The
consumer never appends return data, persists/logs/parses the checkout URL/token, embeds an iframe or
proxy, or clears the cart because top-level navigation began.

### Analytics and telemetry boundary

Storefront telemetry is an optional, consent-gated browser concern. Both runtime profiles use the
same repository adapter and the adapter accepts only the SDK's `SCAN`, `CART_VIEW`, and
`CHECKOUT_VIEW` events. Consent and sampling policies are injected explicitly; denied, unknown, or
unavailable consent performs no session or SDK work, and a sampling failure fails closed. Transport
failure returns a finite safe state and never blocks the commerce action that produced the event.

Callers provide only `locationId`, `cartId`, the allowlisted event, an optional route template, and a
caller-stable idempotency key. The adapter constructs metadata from the validated runtime context and
allows only `profile`, `tenantId`, and `routeTemplate`. It ignores arbitrary caller metadata. Customer
identifiers, contact details, JWTs, cart/receipt capabilities, checkout handoffs, request bodies, raw
URLs, and provider secrets never enter telemetry metadata or returned error state.
Route metadata is restricted to the audited templates `/:locationId`, `/:locationId/fulfillment`,
`/:locationId/cart`, and `/:locationId/checkout`; literal route values are rejected.

The browser adapter keeps no telemetry queue or local event history. The fixture adapter records the
same SDK-shaped calls in memory only and makes zero network requests. Any server-side retention,
deletion, export, or consent-revocation processing remains a durable platform contract and requires
separate published evidence; this consumer does not infer or claim it.

## Request and response shapes used across lanes

```ts
export type StartOrderingSessionRequest = {
  existingCartId?: string | null;
  marketplaceId?: string;
  fulfillmentMethod: "takeout" | "table_side" | "room_service" | "delivery";
  channel?: string;
  metadata?: Record<string, unknown>;
  returnUrl?: string;
};

export type StartOrderingSessionResponse = {
  cart: StorefrontCart;
  cartAccessToken?: string;
};

export type OrderResult =
  | { state: "payment_pending" }
  | { state: "order_pending" }
  | { state: "completed"; order: PublicOrderDetail }
  | { state: "failed"; code: string };

export type StorefrontErrorEnvelope = {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
};
```

The cart contains a numeric `revision`, lifecycle status (`OPEN`, `LOCKED`, `COMPLETED`, `EXPIRED`),
server-calculated decimal-string totals and their formatted display twins, items, fulfillment
method, and mode detail objects. Gate 0 requires the SDK declaration, OpenAPI schema, and staging
response to agree on every returned field, including item/modifier formatted amounts, cart
`*Formatted` totals, `enterpriseFeeTotal`, `orderTotalWithServiceFeeAmount`, `lockedAt`, and
`expiresAt`. A returned field must be deliberately documented/typed or removed from the public
response; permissive root `additionalProperties` and declarations that silently hide extra fields
do not pass Gate 0.

## Error handling

Handle these public codes explicitly:

| Code | UI behavior |
|---|---|
| `VALIDATION_ERROR` | Attach safe field details or show a form-level correction |
| `UNAUTHORIZED` | Clear customer session and request sign-in; do not clear an unrelated guest cart |
| `FORBIDDEN` | Clear only the rejected capability/session and offer a clean restart |
| `NOT_FOUND` | Show unavailable/expired state; do not reveal whether another tenant owns it |
| `RATE_LIMITED` | Back off and show retry timing; no tight polling |
| `CART_CONFLICT` | Render refreshed cart and require an explicit retry |
| `RESOURCE_CONFLICT` | Refresh the affected address/resource revision |
| `CART_IMMUTABLE` | Stop mutation; completed/locked/expired carts are terminal for editing |
| `IDEMPOTENCY_KEY_REQUIRED` | Treat as integration defect caught by tests |
| `IDEMPOTENCY_KEY_REUSED` | Do not retry with a different payload under the same key |
| `IDEMPOTENCY_IN_PROGRESS` | Poll/read the resource; do not launch parallel duplicate mutations |
| `DEPENDENCY_UNAVAILABLE` | Show a bounded provider-degraded state |
| `INTERNAL_ERROR` | Show generic failure and log only `requestId`, method, and route template |

Never log full URLs, request/response bodies, headers, tokens, client secrets, or customer identifiers.

## Money and display

- The API calculates every subtotal, fee, tax, tip, discount, and order total.
- Cart/catalog responses provide server-formatted display fields; use those fields for matching UI.
- For a public response that exposes only a decimal string plus ISO currency, use the shared
  display-only formatter. Formatting is allowed; summing, multiplying, or deriving authoritative
  totals in application code is not.
- `orderTotalWithServiceFeeAmount` is the payment-provider minor-unit integer and is never rendered
  as customer money. Gate 0 proves its currency conversion against the corresponding raw/formatted
  total.
- For the same completed order, `PublicOrderSummary.orderTotal`,
  `PublicOrderDetail.pricing.total`, the protected-receipt total, and the cart's charged
  `orderTotalWithServiceFee` must represent the same payable amount. Gate 0 rejects a summary that
  excludes a service fee or otherwise disagrees with detail/payment.
- Contract tests prove each formatted twin represents its raw field and currency and that SDK types
  do not omit fields present in OpenAPI/staging.
- Do not use Figma's contradictory mock totals as fixture truth.
- Fixture assertions must prove displayed line totals and server-returned summary totals are copied
  from their respective contract fields, not recalculated.

## Known product/platform gaps

- Group order has no public domain model: C4–C7 remain cut.
- Charge to room has no tender/PMS integration: K9 remains cut.
- Live courier tracking has no ETA/driver/tracking contract: T4 remains cut.
- Curbside arrival has no customer arrival mutation: T5 remains cut.
- Completed orders currently persist delivery destination, but tableside and room-service detail
  still need an explicit platform release before those modes are production-complete.
- Modifier quantity can be updated directly; replacing a line's modifier tree remains remove + add
  and must be presented as a replacement, not an atomic edit.
- Search remains local filtering over the fetched menu bundle.
- Saved-address serviceability and delivery radius remain product policy outside the current API.

## Gate 0 acceptance script

The platform owner records exact output in the plan PR:

```bash
pnpm view @craveup/storefront-sdk@2.0.1 version
pnpm add --save-exact @craveup/storefront-sdk@2.0.1
pnpm install --frozen-lockfile
pnpm contract:check
pnpm contract:smoke
pnpm verify
```

Expected results:

- npm resolves exactly `2.0.1` with the recorded SRI without private repository access;
- the lockfile contains no SDK 1.x and no API-key client option;
- OpenAPI hash matches `docs/contracts/storefront-api-baseline.json`;
- anonymous catalog, ordering-session creation, one conflict path, OTP test flow, customer orders,
  saved addresses, exact-key cart-delete replay, hosted-checkout prepare/expiry/replay/wrong-origin
  denial and browser navigation, plus order result/protected receipt only through a released safe
  consumer result contract, and capability-gated loyalty disabled/unavailable/enabled smoke pass;
- explicit existing-cart recovery sends the supplied revision without a fabricated capability,
  persists the returned cart/revision, and claim removes the guest capability before a JWT-owned read;
- anonymous public reads carry no customer `Authorization` header even when a token callback returns
  a sentinel JWT;
- an API failure's `X-Request-Id` is returned safely and the exact id is searchable in hosted
  staging logs without request bodies or authorization/capability headers; and
- the SDK reserved-header sanitizer may contain the literal `X-API-Key` only to delete caller values;
  behavior proves no request emits it; and
- a static bundle/HTML/config/source-map scan contains no Crave API key, capability, customer JWT,
  receipt token, opaque checkout URL/token, Stripe/provider package/config, client secret, or exchange
  call.

Until all expected results are recorded, only the corresponding live claims remain gated. Exact-SDK
adapters, canonical fixtures, anonymous reads, and unrelated consumer work may proceed.
