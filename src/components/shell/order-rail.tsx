import Image from "next/image";

import { Button } from "@/components/ui/button";
import type { OrderRailView } from "@/features/catalog/catalog-types";

export interface OrderRailProps {
  order: OrderRailView;
}

export function OrderRail({ order }: OrderRailProps) {
  return (
    <aside className="order-rail" aria-labelledby="order-rail-title">
      <h2 id="order-rail-title">Your order</h2>
      <div className="order-rail-items">
        {order.items.map((item) => (
          <div className="order-rail-item" key={item.id}>
            {item.imageSrc ? (
              <span className="order-rail-thumb">
                <Image
                  src={item.imageSrc}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="40px"
                />
              </span>
            ) : null}
            <span>
              <strong>{item.name}</strong>
              <small>{item.formattedPrice}</small>
            </span>
          </div>
        ))}
      </div>
      <dl className="order-rail-totals">
        {order.rows.map((row) => (
          <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>{row.formattedValue}</dd>
          </div>
        ))}
        <div className="order-rail-total">
          <dt>Total</dt>
          <dd>{order.formattedTotal}</dd>
        </div>
      </dl>
      <Button disabled>
        {order.actionLabel}
      </Button>
    </aside>
  );
}
