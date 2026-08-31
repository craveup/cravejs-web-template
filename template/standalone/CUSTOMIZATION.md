# Supported Customization

Standalone projects share the same commerce and presentation core as hosted storefronts. Customize
only the documented extension points below so future releases can detect conflicts and preserve user
work.

## Themes And Assets

Theme values come from the committed generated-token inputs and approved implementation invariants.
Do not hand-type raw colors, arbitrary font sizes, radii, or transition durations in screen code.
The generated project contains the reviewed theme and component output, not the template
repository's Figma export and release-authoring toolchain. Edit the generated theme tokens and
components directly, then run the generated-project verification and production build before
deploying.

Public fonts and assets require documented source/license information, stable local paths, dimensions,
checksums, and accessible alt or decorative decisions. Remote asset origins must be exact and
evidence-backed; an empty allowlist remains valid.

## Content And Layout

- Localized message catalogs and merchant-authored content may be extended without adding an
  unreviewed locale switcher.
- Shell and screen composition may use explicitly exported slots. Do not copy the shared feature
  core into profile-specific components.
- Responsive work retains the established `1024px` shell breakpoint, keyboard behavior, reduced
  motion, 200 percent reflow, and semantic design tokens.

## Telemetry And Deployment

Public telemetry adapters must remain consent-gated and allowlist event fields. They must redact
customer data, session values, capabilities, checkout handoff data, and tenant-sensitive details.
Deployment configuration may vary outside the shared commerce core while preserving security
headers, exact origins, tenant isolation, accessibility, localization, SEO, and profile behavior.

## Protected Core

Do not replace the repository SDK clients, session adapters, cart recovery, hosted-checkout handoff,
or server-calculated money flow. UI code renders API-provided formatted values and does not calculate
totals, taxes, fees, tips, discounts, loyalty value, or per-person amounts.

Run the complete checks after a supported customization:

```bash
pnpm verify
pnpm build
```
