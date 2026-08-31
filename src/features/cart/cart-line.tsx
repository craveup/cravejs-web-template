"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import { useId } from "react";

import { QuantitySelector } from "@/components/ui/quantity-selector";

import styles from "./cart-page.module.css";

export interface CartModifierView {
  id: string;
  label: string;
  children?: readonly CartModifierView[];
}

export interface CartLineView {
  id: string;
  name: string;
  description?: string;
  imageSrc?: string;
  formattedLineTotal: string;
  quantity: number;
  modifiers: readonly CartModifierView[];
  specialInstructions?: string;
  maximumQuantity?: number;
  quantityLabel: string;
  decreaseQuantityLabel: string;
  increaseQuantityLabel: string;
  removeLabel: string;
  specialRequestLabel: string;
}

export interface CartLineProps {
  item: CartLineView;
  eager?: boolean;
  pending?: boolean;
  onQuantityChange?: (itemId: string, quantity: number) => void | Promise<void>;
  onRemove?: (itemId: string) => void | Promise<void>;
  variant?: "default" | "tableside";
}

function flattenModifiers(
  modifiers: readonly CartModifierView[],
): readonly Omit<CartModifierView, "children">[] {
  return modifiers.flatMap(({ children, ...modifier }) => [
    modifier,
    ...flattenModifiers(children ?? []),
  ]);
}

function ModifierList({ modifiers }: { modifiers: readonly CartModifierView[] }) {
  const flattenedModifiers = flattenModifiers(modifiers);

  if (!flattenedModifiers.length) return null;

  return (
    <ul className={styles.modifiers}>
      {flattenedModifiers.map((modifier) => (
        <li key={modifier.id}>{modifier.label}</li>
      ))}
    </ul>
  );
}

export function CartLine({
  item,
  eager = false,
  pending = false,
  onQuantityChange,
  onRemove,
  variant = "default",
}: CartLineProps) {
  const titleId = useId();
  const quantityDisabled = pending || !onQuantityChange;
  const removeDisabled = pending || !onRemove;

  return (
    <article
      aria-busy={pending || undefined}
      aria-labelledby={titleId}
      className={styles.line}
      data-has-image={Boolean(item.imageSrc)}
      data-variant={variant}
    >
      {item.imageSrc ? (
        <div className={styles.lineImage}>
          <Image
            src={item.imageSrc}
            alt=""
            fill
            loading={eager ? "eager" : "lazy"}
            sizes="(min-width: 1024px) 96px, 64px"
          />
        </div>
      ) : null}

      <div className={styles.lineContent}>
        <div className={styles.lineHeading}>
          <h2 id={titleId}>{item.name}</h2>
          <strong>{item.formattedLineTotal}</strong>
        </div>

        {item.description ? (
          <p className={styles.lineDescription}>{item.description}</p>
        ) : null}

        <ModifierList modifiers={item.modifiers} />

        {item.specialInstructions ? (
          <p className={styles.specialInstructions}>
            <span>{item.specialRequestLabel}</span> {item.specialInstructions}
          </p>
        ) : null}

        <div className={styles.lineActions}>
          <QuantitySelector
            value={item.quantity}
            maximum={item.maximumQuantity}
            disabled={quantityDisabled}
            label={item.quantityLabel}
            decreaseLabel={item.decreaseQuantityLabel}
            increaseLabel={item.increaseQuantityLabel}
            onChange={(quantity) => {
              if (onQuantityChange) void onQuantityChange(item.id, quantity);
            }}
          />
          <button
            className={styles.removeButton}
            type="button"
            disabled={removeDisabled}
            onClick={() => {
              if (onRemove) void onRemove(item.id);
            }}
          >
            {variant === "tableside" ? (
              <>
                <Trash2 aria-hidden="true" className={styles.removeIcon} />
                <span className="sr-only">{item.removeLabel}</span>
              </>
            ) : (
              item.removeLabel
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
