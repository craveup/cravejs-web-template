# Crave.js Standalone Restaurant Storefront

A brand-owned Next.js storefront for restaurant ordering, powered directly by the public Crave
Storefront API.

Design the experience your restaurant deserves without rebuilding menus, nested modifiers, carts,
pickup, delivery, fixture-backed tableside and in-room previews, hosted checkout handoff, accounts,
order history and capability-gated loyalty.

> [!IMPORTANT]
> This README is public input for the future `standalone-cli` generator. That generator is not
> implemented yet, so this content pack cannot generate, publish or upgrade a project by itself. An
> accepted generator will consume only a signed immutable template release with verified checksums.

## What you get

- Restaurant-aware menu, product and modifier experiences
- Server-authoritative cart totals and explicit conflict recovery
- Pickup now/later and delivery flows; preview-only tableside and room-service UI
- Exact-origin handoff to Crave-hosted checkout—no embedded payment-provider secrets
- OTP account access, saved details, orders and capability-gated loyalty
- Responsive, accessible and localized UI with SEO and consent-aware telemetry boundaries
- Documented theme, photography, content and composition extension points

Tableside and room-service UI is a fixture-backed preview. Completed-order detail persistence and
terminal order/receipt handling remain externally gated.

## Try it locally

The fastest safe path uses deterministic fixture data. It needs no Crave credentials and makes no
Storefront API request.

### Prerequisites

- Node.js 24
- pnpm 10.33.2 through Corepack

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:fixtures --profile standalone-cli --tenant fixture-base
```

Open [http://localhost:3000](http://localhost:3000). The fixture runtime is visibly labeled and can
be used for design exploration, component work and contribution review.

## Connect your restaurant

Copy `.env.example` to `.env.local`, then replace only the documented public merchant and deployment
examples. Keep the generated `projectId`, `tenantId`, template release and schema versions unchanged.

| Setting | What it controls |
|---|---|
| `NEXT_PUBLIC_CRAVEUP_API_URL` | Exact public Storefront API origin |
| `STOREFRONT_PROFILE` | Must be `standalone-cli` in this project |
| `STOREFRONT_STANDALONE_CONFIG_JSON` | Merchant, canonical origin, allowed origins, theme, locale, timezone and public capability flags |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional domain-restricted browser key for delivery address UX |

See [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) for the complete field contract. The storefront
does not accept a private repository URL, browser Crave API key, customer session, cart/receipt
capability or payment-provider value in configuration.

Once public configuration validates, run the live development profile:

```bash
pnpm dev
```

Production fails closed when required configuration is missing or invalid; it never falls back to a
fixture or demo merchant.

## Make it yours

Start with one of the generated themes, then customize approved theme inputs, local public fonts,
photography, merchant content, localized messages and exported composition slots. Keep the shared
SDK clients, cart recovery, session adapters, checkout handoff and server-calculated money flow
intact so future releases can detect conflicts and preserve your work.

Read [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md) before changing the shared core.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev:fixtures --profile standalone-cli --tenant fixture-base` | Run the labeled zero-network storefront |
| `pnpm dev` | Run against validated public merchant configuration |
| `pnpm verify` | Lint and typecheck the generated project |
| `pnpm build` | Produce the release-gated production build |
| `pnpm start` | Serve the completed production build |
| `pnpm profile:smoke` | Smoke-test the selected built profile and host |

## Verify and deploy

```bash
pnpm verify
pnpm build
pnpm start
```

After a production build, set the selected standalone profile and smoke-test host in the deployment
environment, then run `pnpm profile:smoke`. Provider-neutral hosting requirements, security headers,
origins, rollback and smoke evidence are documented in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Project guides

- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) — validated public runtime settings
- [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md) — supported themes, content and extension points
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production and rollback requirements
- [`docs/UPGRADING.md`](docs/UPGRADING.md) — future non-destructive upgrade contract

This project talks directly to the public Crave Storefront API through the pinned SDK. It needs no
private Crave repository, browser Crave API key, embedded payment provider or Crave BFF.
