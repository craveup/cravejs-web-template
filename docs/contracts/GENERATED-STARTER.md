# Generated Storefront Starter Contract

- **Status:** Approved delivery contract; CLI 2.x release integration awaits immutable template releases
- **Audience:** Maintainers of this template and the external storefront CLI
- **Profile:** `standalone-cli`
- **Security boundary:** Public release artifacts only; no private Crave repository or API key

This contract defines how an external CLI consumes an immutable release of this repository, what it
may generate, and how a generated project proves its provenance and upgrade compatibility. It does
not grant the CLI access to Crave's private API or hosted tenant registry.

## 1. Release input

The CLI consumes a published template artifact identified by all of:

- an exact semantic version with no range;
- one 40-character reviewed Git commit;
- the release artifact's `sha256-<base64>` SRI;
- exact `@craveup/storefront-sdk` version and `sha512-<base64>` npm SRI;
- the accepted 64-character lowercase OpenAPI SHA-256 and API release;
- the config-schema semantic version and 64-character lowercase SHA-256; and
- the minimum compatible CLI version.

The target Crave CLI 2.x registry contains exactly two entries: `web`, supplied by this repository,
and `expo`, supplied by `craveup/cravejs-expo-template`. Published CLI 1.x artifacts retain
their own versioned catalogue; this repository publishes only the new `web` release record and does
not add legacy aliases to the 2.x registry. Because this new web template has not shipped, aliases
and legacy template choices are prohibited inside its proven pre-release scope.

Those values are published together in a signed/provenance-backed `template-release.json` whose
identity matches this canonical registry entry:

```ts
export type Sha256Sri = `sha256-${string}`; // SHA-256 digest encoded as canonical base64
export type Sha512Sri = `sha512-${string}`; // SHA-512 digest encoded as canonical base64
export type Sha256Hex = string; // exactly 64 lowercase hexadecimal characters

export interface WebTemplateRegistryEntry {
  id: "web";
  repository: "craveup/cravejs-web-template";
  platform: "web";
  profile: "standalone-cli";
  templateRelease: string; // exact semver, never a range
  templateCommit: string; // exactly 40 lowercase hexadecimal characters
  templateIntegrity: Sha256Sri; // SHA-256 SRI: sha256-<base64>
  sdkPackage: "@craveup/storefront-sdk";
  sdkVersion: "2.0.1";
  sdkIntegrity: Sha512Sri;
  apiRelease: string;
  openapiSha256: Sha256Hex;
  minimumCliVersion: "2.0.0"; // exact semver lower bound, never a range
  configSchemaVersion: "1.0.0";
  configSchemaSha256: Sha256Hex;
}
```

Release validation requires `templateIntegrity` to be `sha256-<base64>`, `sdkIntegrity` to be
`sha512-<base64>`, and every field whose name ends in `Sha256` to be exactly 64 lowercase hexadecimal
characters. Prefixes, base64/hex encodings, case, and digest lengths are not interchangeable.

The CLI rejects a registry/release mismatch for any identity, version, commit, integrity, API/SDK,
minimum-CLI, config-schema-version, or config-schema-digest field. `minimumCliVersion` records one
exact semver lower bound; the CLI uses semver comparison against its own exact version rather than
treating the field as a range. The CLI must never generate from a branch, mutable archive URL,
abbreviated SHA, workspace checkout, `latest` alias, or private repository coordinate. A missing or
mismatched value stops generation.

## 2. Generator inputs

Interactive prompts and noninteractive flags produce the same user input:

```ts
export interface StorefrontNewsletterConfig {
  readonly heading: string;
  readonly emailLabel: string;
  readonly submitLabel: string;
  readonly consentCopy: string;
  readonly successMessage: string;
}

export interface StandaloneGeneratorInput {
  projectName: string;
  outputDirectory: string;
  templateRelease: string;
  merchantSlug: string;
  canonicalOrigin: string;
  apiBaseUrl: string;
  assetOrigins: readonly string[];
  checkoutOrigins: readonly string[];
  themeId: string;
  locale: string;
  timeZone: string;
  capabilities: {
    loyalty: boolean;
  };
  newsletter: StorefrontNewsletterConfig | null;
  includeFixtures: boolean;
}

export interface ResolvedStandaloneGeneratorInput extends StandaloneGeneratorInput {
  readonly projectId: string; // CLI-generated RFC 4122 UUID
}
```

`newsletter` is public merchant-owned copy only. It is either `null` or an exact object with the
five fields above. Values are trimmed, non-empty strings; `heading`, `emailLabel`, and `submitLabel`
are limited to 120 characters, while `consentCopy` and `successMessage` are limited to 500. It never
contains a provider, endpoint, credential, request history, submitted email, or tenant authority.

Generated config can enable the optional future signup band with public copy such as:

```ts
newsletter: {
  heading: "Stay in the loop",
  emailLabel: "Email address",
  submitLabel: "Subscribe",
  consentCopy: "Get restaurant news and offers in your inbox.",
  successMessage: "Thanks for subscribing.",
}
```

The CLI resolves user input by generating `projectId` once; it is never an interactive flag, branding
prompt, or tenant credential. Deterministic generator tests may inject a fixed UUID through the
internal test harness, while a real generated project keeps its UUID in config and provenance for its
entire upgrade history. Validation requires a valid UUID, safe package/project name, empty or
explicitly approved output directory, exact published release, HTTPS production origins, allow-listed
asset origins (including an honest empty array), one or more exact HTTPS hosted-checkout origins,
supported theme, BCP 47 locale, IANA timezone, and explicit loyalty capability. The
generator prints the resolved public configuration and file plan before writing. Noninteractive mode
fails rather than guessing a required user value.

The CLI first validates generated configuration against the exact release-owned JSON Schema and then
must execute the schema's `x-crave-semanticValidator` reference,
`../../src/config/storefront-regional-semantics.mjs#validateStorefrontRegionalConfig`, from the same
verified release artifact. The semantic validator is authoritative for BCP 47 locale and IANA time-zone membership,
which JSON Schema patterns cannot represent completely. A missing, changed, or failing validator stops
generation before any project file is written.

The generator never asks for, reads, copies, or emits:

- a private Crave repository URL or checkout;
- `CRAVE_API_KEY`, `NEXT_PUBLIC_CRAVEUP_API_KEY`, or any API-key header;
- cart/receipt capabilities, customer JWTs, opaque checkout URLs/tokens, Stripe/provider values, or
  idempotency keys;
- Figma, npm, GitHub, deployment, analytics-provider, or error-monitoring secrets; or
- a hosted custom-domain registry export.

## 3. Generated project

Generation produces a uniquely named public application with:

- `standalone-cli` selected as its immutable runtime profile;
- an immutable `projectId` and runtime `tenantId` namespace of `standalone:${projectId}`;
- typed public configuration and environment validation;
- the shared storefront core and generated theme assets from the pinned release;
- public-only `.env.example` values with explanations, never working credentials;
- a labeled, zero-network fixture command and a live-safe development command;
- setup, customization, deployment, testing, accessibility, localization, telemetry/consent, and
  upgrade documentation; and
- `.crave/storefront-template.json` containing exact provenance.

The provenance file conforms to:

```ts
export interface GeneratedTemplateProvenance {
  schemaVersion: 1;
  id: "web";
  repository: "craveup/cravejs-web-template";
  platform: "web";
  profile: "standalone-cli";
  projectId: string; // immutable UUID preserved across upgrades
  templateRelease: string; // exact semver
  templateCommit: string; // exactly 40 lowercase hexadecimal characters
  templateIntegrity: Sha256Sri; // SHA-256 SRI: sha256-<base64>
  sdkPackage: "@craveup/storefront-sdk";
  sdkVersion: "2.0.1";
  sdkIntegrity: Sha512Sri;
  apiRelease: string;
  openapiSha256: Sha256Hex;
  minimumCliVersion: "2.0.0";
  configSchemaVersion: "1.0.0";
  configSchemaSha256: Sha256Hex;
  generatedBy: string; // exact CLI package version
  generatedAt: string; // RFC 3339 UTC timestamp
}
```

The CLI copies these values from the verified release manifest. A user prompt, environment variable,
or local Git checkout cannot override them.

## 4. Runtime rules

The generated project uses its typed config resolver and does not require the hosted host/custom-
domain registry. Invalid configuration fails during validation/build and shows a safe actionable
development error; it never falls back to a demo merchant in production.

The resolver validates the persisted UUID and derives `tenantId` as `standalone:${projectId}` on every
boot. That value namespaces cache, theme, metadata, telemetry, and session coordination without
pretending the external project has a Crave-hosted registry record. Renaming the package or changing
the canonical origin does not change the project ID.

The configured loyalty flag is only one half of the gate. The effective capability is true only when
the generated config enables loyalty and the public merchant/API contract reports it available.
Disabled or unavailable loyalty never blocks browse, cart, checkout, or order completion.

Production theme comes from generated configuration. `?theme=` is permitted only in an explicitly
labeled local/preview mode, cannot select a merchant, and is rejected or ignored in production.

The generated project retains all common security, commerce, accessibility, localization/timezone,
responsive, telemetry/consent, SEO, and public SDK contract requirements from the master plan. A
starter is not allowed to weaken those requirements merely because it is externally hosted.

## 5. Extension and ownership boundary

Generated projects may customize documented extension points:

- generated theme token inputs and public font/assets;
- localized message catalogs and merchant content;
- composition slots expressly exported by shell and screen components;
- public telemetry adapters that honor consent/redaction; and
- deployment configuration outside the shared commerce core.

The CLI does not rewrite arbitrary user files on upgrade. Files owned by the template are declared
in the release manifest; user-owned extension files are declared separately. If a file cannot be
updated without overwriting user work, the upgrade stops and reports the conflict.

## 6. Version and upgrade policy

### Pre-release greenfield rule

Before the first accepted public template release, this new web template's own configuration, generated
routes, components, and behavior proven never deployed and never published have no compatibility aliases,
shims, or dual paths. A change updates every in-scope generator/template caller and deletes the obsolete
path in the same bounded change.

This template pre-release rule does not authorize breaking currently deployed hosted storefront or API
behavior, a published SDK/package artifact, external provider contracts, or persisted approved data.
Those are durable compatibility obligations regardless of whether known external consumers are found.
They change through additive versioning or a new contract, migration, and operational cutover/rollback
gate. Its exact support window, removal condition, and tests are release evidence; it is not permission
to keep an unbounded old/new implementation fork.

The following version and upgrade rules apply to accepted published template releases and generated
projects whose approved provenance/configuration already persists:

- **Patch:** compatible fixes with no generated-config or extension-point break.
- **Minor:** backward-compatible capabilities, optional config, components, and codemods.
- **Major:** breaking config, SDK/OpenAPI baseline, file ownership, extension, or runtime behavior.

Every release publishes a compatibility table covering template, CLI, Node, pnpm, SDK, and OpenAPI
baseline versions. An upgrade compares `.crave/storefront-template.json` with that table before
changing files.

Upgrade behavior must provide:

1. `--dry-run` with the exact source and target releases;
2. a deterministic file diff and list of required environment/config changes;
3. checksum verification before extraction;
4. codemods for mechanical compatible changes;
5. a migration guide for semantic/manual changes;
6. conflict detection with no silent overwrite;
7. a post-upgrade frozen install, typecheck, tests, production build, and core E2E; and
8. rollback instructions that restore the previous release and provenance file without deleting
   user-owned content.

An upgrade preserves `projectId`; changing it is project regeneration, not an upgrade. The target
release must accept the recorded `configSchemaVersion` and exact `configSchemaSha256`, or provide a
reviewed migration before writing.

Skipping major versions is supported only when the published compatibility graph and migration
chain explicitly allow it.

## 7. Generated-project acceptance gate

Release CI creates a clean temporary directory and proves, without private access:

```text
resolve exact release → verify checksum/provenance → generate noninteractively
→ frozen install → lint → typecheck → unit/component tests → production build
→ fixture smoke with zero API requests → public staging-safe smoke → Playwright core journey
→ accessibility/profile/secret/private-reference scans
```

The gate runs on macOS/Linux-supported Node and pnpm versions declared by the compatibility table.
It fails if the project contains a branch/latest pin, a private package/repository reference, an API
key field/header, an unresolved template placeholder, an unlabeled fixture mode, or provenance that
does not match the release artifact.

## 8. Release evidence

The template release record includes canonical id/repository/platform/profile, exact template commit/
SHA-256 SRI, minimum and tested CLI versions, config-schema version/SHA-256, SDK version/SHA-512 SRI,
API release, OpenAPI SHA-256, generated-project CI result, dependency/license scan, SBOM/provenance
link, known migrations, and rollback result. The hosted profile records the same shared-core identity
so a behavior difference can be traced to profile configuration rather than an unknown template
version.
