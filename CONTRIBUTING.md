# Contributing to Crave.js Restaurant Storefront

Thank you for helping make restaurant ordering more expressive without weakening commerce behavior.
This repository is currently a release candidate, not a published starter.

## Before contributing

This repository includes an MIT [`LICENSE`](LICENSE). It remains a private release candidate, so
external contribution intake begins only after Crave makes the repository public and announces its
contribution status. Current collaborators may submit scoped work under their existing agreements.

For a proposed change:

1. Search existing issues and pull requests.
2. Open an issue for a new behavior, public contract, dependency or large design direction.
3. Keep one reviewable concern per pull request.
4. Start from the latest verified `dev` branch and target `dev` unless a maintainer names a different
   release branch.

## Safe local setup

Use the credential-free fixture profile first:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:fixtures --profile standalone-cli --tenant fixture-base
```

Fixture mode must remain labeled and zero-network. Never add a Crave API key, customer session, cart
or receipt capability, checkout token, provider credential, idempotency key, or real restaurant data
to source, fixtures, screenshots, logs, issues or pull requests.

## What belongs here

Good contributions improve the shared Next.js storefront, fixtures, accessibility, localization,
documented theme/content/composition seams, tests, or public developer guidance.

The following boundaries are not open for replacement implementations:

- menu, cart, fulfillment, checkout, account, order and loyalty authority stays in the public
  Storefront API and exact Storefront SDK contract;
- the browser never receives a Crave API key or payment-provider secret;
- fixture mode never falls through to a live API;
- themes and restaurant concept presets do not duplicate commerce logic;
- checkout remains an exact-origin top-level handoff, not embedded payment UI; and
- generated starters come from signed immutable releases, never a mutable branch.

Read [docs/contracts/STOREFRONT-API.md](docs/contracts/STOREFRONT-API.md)
and [docs/contracts/GENERATED-STARTER.md](docs/contracts/GENERATED-STARTER.md) before changing a
protected boundary.

## Verification

Run the smallest focused test while developing, then the complete repository gate before requesting
review:

```bash
pnpm verify
pnpm build
pnpm distribution:check
```

If a required external gate cannot run, name the exact missing evidence and leave the affected claim
pending. Do not replace it with a fabricated fixture, mutable dependency, private-source copy or
weaker assertion.

## Pull-request evidence

Include:

- the problem and intended user outcome;
- affected profile, route, contract and ownership boundaries;
- exact commands run and their results;
- screenshots or recordings for presentation changes at relevant breakpoints;
- accessibility, localization, recovery and privacy effects; and
- explicit non-goals and unresolved external gates.

By participating, follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Security reports follow
[SECURITY.md](SECURITY.md), not the public issue tracker.
