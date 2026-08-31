export type StorefrontTextDirection = "ltr" | "rtl";

export interface StorefrontLocalePresentation {
  readonly lang: string;
  readonly direction: StorefrontTextDirection;
}

interface LocaleTextInfo {
  readonly direction: string;
}

type LocaleWithTextInfo = Intl.Locale & {
  getTextInfo?: () => LocaleTextInfo;
  readonly textInfo?: LocaleTextInfo;
};

export function getStorefrontLocalePresentation(
  locale: string,
): StorefrontLocalePresentation {
  const parsed = new Intl.Locale(locale) as LocaleWithTextInfo;
  const direction = parsed.getTextInfo?.().direction ?? parsed.textInfo?.direction;

  if (direction !== "ltr" && direction !== "rtl") {
    throw new TypeError("Storefront locale direction is unavailable.");
  }

  return { lang: locale, direction };
}
