import type { Metadata } from "next";

import { getStorefrontLocalePresentation } from "@/content/storefront-locale";
import { FixtureModeBanner } from "@/fixtures/fixture-mode-banner";
import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";
import { loadStorefrontMerchantDirectory } from "@/lib/tenant/server-storefront-seo";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const runtime = await readRequestStorefrontRuntime();
  const merchant = runtime
    ? await loadStorefrontMerchantDirectory(runtime).catch(() => null)
    : null;
  const title = merchant ? `${merchant.name} | Order online` : "Crave Storefront";
  const description =
    merchant?.description || "Browse the menu and place your order online.";

  return {
    title,
    description,
    robots:
      runtime?.mode === "live" && merchant
        ? { index: true, follow: true }
        : { index: false, follow: false },
    ...(runtime
      ? {
          metadataBase: new URL(runtime.config.canonicalOrigin),
          openGraph: {
            type: "website",
            url: "/",
            title,
            description,
            siteName: merchant?.name,
          },
        }
      : {}),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const runtime = await readRequestStorefrontRuntime();
  const locale = getStorefrontLocalePresentation(
    runtime?.config.locale ?? "en",
  );

  return (
    <html
      lang={locale.lang}
      dir={locale.direction}
      data-theme={runtime?.config.themeId ?? "base"}
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {runtime?.mode === "fixture" ? (
          <FixtureModeBanner runtime={runtime} />
        ) : null}
        {children}
      </body>
    </html>
  );
}
