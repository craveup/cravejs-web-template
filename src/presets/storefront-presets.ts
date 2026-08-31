import type { ThemeId } from "@/styles/themes";

export const storefrontPresetIds = [
  "bakery-editorial",
  "noodle-house",
  "sushi-atelier",
  "counter-service",
] as const;

export type StorefrontPresetId = (typeof storefrontPresetIds)[number];

export type StorefrontHomeCompositionId =
  | "editorial-product"
  | "immersive-hero"
  | "split-grid"
  | "service-first";

export interface StorefrontPreset {
  readonly id: StorefrontPresetId;
  readonly name: string;
  readonly description: string;
  readonly defaultThemeId: ThemeId;
  readonly homeCompositionId: StorefrontHomeCompositionId;
  readonly heroImageSrc: `/assets/template/${StorefrontPresetId}-hero.svg`;
  readonly legacySource: {
    readonly repository: `craveup/${string}`;
    readonly commit: string;
  };
}

function freezePreset(preset: StorefrontPreset): StorefrontPreset {
  return Object.freeze({
    ...preset,
    legacySource: Object.freeze({ ...preset.legacySource }),
  });
}

const storefrontPresets = {
  "bakery-editorial": freezePreset({
    id: "bakery-editorial",
    name: "Bakery Editorial",
    description:
      "A warm, product-led story for bakeries, cafes, and chef-driven launches.",
    defaultThemeId: "hearth",
    homeCompositionId: "editorial-product",
    heroImageSrc: "/assets/template/bakery-editorial-hero.svg",
    legacySource: {
      repository: "craveup/restaurant-storefront-starter",
      commit: "d0dbf862350b908f837f1c173a0a6bc37e93dbfe",
    },
  }),
  "noodle-house": freezePreset({
    id: "noodle-house",
    name: "Noodle House",
    description:
      "A full-bleed, appetite-first entrance for noodle bars and expressive casual dining.",
    defaultThemeId: "ember",
    homeCompositionId: "immersive-hero",
    heroImageSrc: "/assets/template/noodle-house-hero.svg",
    legacySource: {
      repository: "craveup/chinese-restaurant-storefront",
      commit: "8ff483f5216a214d1b608ff4e837672bcd0bdac3",
    },
  }),
  "sushi-atelier": freezePreset({
    id: "sushi-atelier",
    name: "Sushi Atelier",
    description:
      "A precise split-grid composition for sushi, omakase, and tasting-menu concepts.",
    defaultThemeId: "noir",
    homeCompositionId: "split-grid",
    heroImageSrc: "/assets/template/sushi-atelier-hero.svg",
    legacySource: {
      repository: "craveup/sushi-restaurant-storefront",
      commit: "726a7cd27587ba50ef7a5362adbd373d5f2a7ca3",
    },
  }),
  "counter-service": freezePreset({
    id: "counter-service",
    name: "Counter Service",
    description:
      "A fast, service-first layout for bowls, counters, pickup, and high-throughput menus.",
    defaultThemeId: "signal",
    homeCompositionId: "service-first",
    heroImageSrc: "/assets/template/counter-service-hero.svg",
    legacySource: {
      repository: "craveup/2026-craveup-ai-storefront-template",
      commit: "5486c38050519455236ce31309acc801bdde7532",
    },
  }),
} as const satisfies Readonly<Record<StorefrontPresetId, StorefrontPreset>>;

export function isStorefrontPresetId(value: unknown): value is StorefrontPresetId {
  return typeof value === "string" && Object.hasOwn(storefrontPresets, value);
}

export function resolveStorefrontPreset(id: string): StorefrontPreset {
  if (!isStorefrontPresetId(id)) {
    throw new Error("Unknown storefront preset.");
  }

  return storefrontPresets[id];
}
