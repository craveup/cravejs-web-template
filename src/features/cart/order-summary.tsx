import styles from "./cart-page.module.css";

export interface CartSummaryRowView {
  id: string;
  label: string;
  formattedValue: string;
  kind?: "default" | "discount";
}

export interface OrderSummaryProps {
  rows: readonly CartSummaryRowView[];
  formattedTotal: string;
  heading: string;
  totalLabel: string;
  showHeading?: boolean;
}

export function OrderSummary({
  rows,
  formattedTotal,
  heading,
  totalLabel,
  showHeading = false,
}: OrderSummaryProps) {
  return (
    <section aria-labelledby="cart-order-summary-title" className={styles.orderSummary}>
      <h2
        className={showHeading ? styles.orderSummaryHeading : "sr-only"}
        id="cart-order-summary-title"
      >
        {heading}
      </h2>
      <dl>
        {rows.map((row) => (
          <div data-kind={row.kind ?? "default"} key={row.id}>
            <dt>{row.label}</dt>
            <dd>{row.formattedValue}</dd>
          </div>
        ))}
        <div className={styles.orderTotal}>
          <dt>{totalLabel}</dt>
          <dd>{formattedTotal}</dd>
        </div>
      </dl>
    </section>
  );
}
