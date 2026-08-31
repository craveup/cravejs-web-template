export interface StorefrontLongFormContent {
  readonly headline: string;
  readonly supportingCopy: string;
  readonly heroImageSrc: string;
  readonly heroImageAlt: string;
  readonly editorialProductIds: readonly string[];
  readonly visitLabel: string;
  readonly companyLabel: string;
  readonly aboutLabel: string;
  readonly copyrightLabel: string;
}

export const baseStorefrontLongFormContent = {
  headline: "Order ahead. Skip the line.",
  supportingCopy:
    "Pick it up, have it delivered, or order right from your table.",
  heroImageSrc: "/assets/template/storefront-hero.svg",
  heroImageAlt: "",
  editorialProductIds: [
    "double-smash-burger",
    "crinkle-fries",
    "chocolate-malt",
    "crispy-chicken-sandwich",
  ],
  visitLabel: "Visit",
  companyLabel: "Company",
  aboutLabel: "About",
  copyrightLabel: "\u00a9 2026",
} as const satisfies StorefrontLongFormContent;
