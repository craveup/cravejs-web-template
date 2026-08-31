# Deployment

Deploy the standalone storefront as a standard Next.js application with public configuration owned
by the generated project. This guide is provider-neutral and does not add payment, analytics, or
hosting credentials.

## Production Configuration

- Set `STOREFRONT_PROFILE` to `standalone-cli`.
- Supply one validated `STOREFRONT_STANDALONE_CONFIG_JSON` value.
- Set `NEXT_PUBLIC_CRAVEUP_API_URL` to the same exact origin as config `apiBaseUrl`.
- Use exact HTTPS canonical, API, asset, and hosted-checkout origins.
- Restrict the optional Google Maps browser key by deployed domain and required APIs.
- Keep server and browser logs free of customer sessions, cart/receipt capabilities, opaque checkout
  handoff values, idempotency values, and submitted newsletter emails.

The project fails closed when required public configuration is missing or malformed. Production must
not enable fixture runtime or use fixture data as a fallback.

## Build And Start

Install and verify the locked release before building:

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm build
```

Start the production server with:

```bash
pnpm start
```

The deployment platform must preserve the repository security headers, disable public production
source maps unless explicitly reviewed, and allow only the exact configured network/image origins.

## Smoke And Rollback

After `pnpm build`, set `STOREFRONT_PROFILE`, `STOREFRONT_PROFILE_SMOKE_HOST`, the selected profile
configuration, and an optional non-privileged `STOREFRONT_PROFILE_SMOKE_PORT`. Then run:

```bash
pnpm profile:smoke
```

Record the exact template commit and deployment identity. A failed smoke, configuration mismatch, or
security-header regression stops promotion. Roll back to the previously reviewed immutable release
and repeat the build and smoke checks; do not mix files from two releases.

Hosted checkout remains an exact-origin top-level handoff. The storefront does not render card or
wallet UI, proxy checkout, or treat navigation as payment/order success.
