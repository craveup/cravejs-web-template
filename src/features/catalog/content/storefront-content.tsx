import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { MenuItemCard } from "@/components/ui/menu-item-card";
import type { StorefrontLongFormContent } from "@/content/storefront-long-form";

import type { StorefrontLongFormData } from "./storefront-long-form-data";
import styles from "./storefront-content.module.css";

export interface StorefrontLongFormProps {
  readonly content: StorefrontLongFormContent;
  readonly data: StorefrontLongFormData;
  readonly newsletter?: ReactNode;
}

export function StorefrontLongForm({
  content,
  data,
  newsletter,
}: StorefrontLongFormProps) {
  const locationHref = `/${encodeURIComponent(data.location.id)}`;
  const aboutHref = `${locationHref}/about`;

  return (
    <StorefrontShell
      variant="long-form"
      header={
        <StorefrontHeader
          brand={data.location.name}
          brandHref={locationHref}
          items={[
            { id: "menu", label: "Menu", href: `${locationHref}#menu` },
            { id: "locations", label: "Locations", href: "/stores" },
            { id: "about", label: content.aboutLabel, href: aboutHref },
          ]}
          addressLabel={data.location.addressLabel}
          cartLabel="Cart"
        />
      }
      hero={
        <div className={styles.hero} data-testid="long-form-hero">
          <Image
            src={content.heroImageSrc}
            alt={content.heroImageAlt}
            fill
            preload
            sizes="100vw"
          />
        </div>
      }
    >
      <article className={styles.page}>
        <section
          className={styles.editorial}
          aria-labelledby="long-form-heading"
        >
          <div className={styles.inner}>
            <div className={styles.introduction}>
              <h1 id="long-form-heading">{content.headline}</h1>
              <p>{content.supportingCopy}</p>
            </div>
            {data.items.length ? (
              <div className={styles.items} aria-label="Featured menu items">
                {data.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    name={item.name}
                    imageSrc={item.imageSrc}
                    formattedPrice={item.formattedPrice}
                    availability={item.availability}
                    href={item.href}
                    layout="grid"
                  />
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {newsletter}

        <footer className={styles.footer}>
          <div
            className={styles.footerInner}
            data-testid="long-form-footer-inner"
          >
            <div
              className={styles.footerDetails}
              data-testid="long-form-footer-details"
            >
              {data.location.addressLabel ? (
                <section aria-labelledby="long-form-visit-heading">
                  <h2 id="long-form-visit-heading">{content.visitLabel}</h2>
                  <address>{data.location.addressLabel}</address>
                </section>
              ) : null}
              <section aria-labelledby="long-form-company-heading">
                <h2 id="long-form-company-heading">{content.companyLabel}</h2>
                <Link href={aboutHref} aria-current="page">
                  {content.aboutLabel}
                </Link>
              </section>
            </div>
            <p className={styles.wordmark}>{data.location.name}</p>
            <p className={styles.copyright}>{content.copyrightLabel}</p>
          </div>
        </footer>
      </article>
    </StorefrontShell>
  );
}
