import Image from "next/image";
import Link from "next/link";

import type { CatalogItemView } from "@/features/catalog/catalog-types";

export interface MenuItemCardProps
  extends Pick<
    CatalogItemView,
    | "name"
    | "description"
    | "imageSrc"
    | "formattedPrice"
    | "availability"
  > {
  href?: string;
  imageFetchPriority?: "auto" | "high" | "low";
  layout?: "grid" | "list" | "compact";
  eager?: boolean;
}

export function MenuItemCard({
  name,
  description,
  imageSrc,
  formattedPrice,
  availability,
  href,
  imageFetchPriority,
  layout = "grid",
  eager = false,
}: MenuItemCardProps) {
  const unavailable = availability === "unavailable";

  const card = (
    <article
      className="menu-item-card"
      data-layout={layout}
      data-availability={availability}
    >
      {imageSrc ? (
        <div className="menu-item-image">
          <Image
            src={imageSrc}
            alt=""
            fill
            fetchPriority={imageFetchPriority}
            loading={eager ? "eager" : "lazy"}
            sizes={layout === "grid" ? "(min-width: 1024px) 210px, 46vw" : "96px"}
          />
        </div>
      ) : null}
      <div className="menu-item-copy">
        <h3>{name}</h3>
        {description ? <p>{description}</p> : null}
        <strong>{formattedPrice}</strong>
        {unavailable ? <span className="availability-label">Unavailable</span> : null}
      </div>
    </article>
  );

  return href ? (
    <Link className="menu-item-link" href={href} aria-label={`View ${name}`}>
      {card}
    </Link>
  ) : card;
}
