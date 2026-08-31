"use client";

import { Minus, Plus } from "lucide-react";

export interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  minimum?: number;
  maximum?: number;
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
}

export function QuantitySelector({
  value,
  onChange,
  label = "Quantity",
  minimum = 1,
  maximum,
  disabled = false,
  decreaseLabel,
  increaseLabel,
}: QuantitySelectorProps) {
  const canDecrease = !disabled && value > minimum;
  const canIncrease = !disabled && (maximum === undefined || value < maximum);

  return (
    <div className="quantity-selector" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={decreaseLabel ?? `Decrease ${label.toLowerCase()}`}
        disabled={!canDecrease}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden="true" />
      </button>
      <output aria-live="polite" aria-label={`${label}: ${value}`}>
        {value}
      </output>
      <button
        type="button"
        aria-label={increaseLabel ?? `Increase ${label.toLowerCase()}`}
        disabled={!canIncrease}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}
