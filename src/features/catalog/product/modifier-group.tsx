"use client";

import type { RefCallback } from "react";

import { QuantitySelector } from "@/components/ui/quantity-selector";

import type { ActiveModifierGroup, ModifierSelections } from "./modifier-state";
import type { ModifierGroupValidationError } from "./item-types";

export interface ModifierGroupProps {
  instance: ActiveModifierGroup;
  selections: ModifierSelections;
  error?: ModifierGroupValidationError;
  registerGroup: RefCallback<HTMLFieldSetElement>;
  onQuantityChange: (path: string, optionId: string, quantity: number) => void;
}

function ruleLabel(instance: ActiveModifierGroup) {
  if (instance.minimum === 0) {
    return instance.maximum === 1 ? "Optional" : `Optional - up to ${instance.maximum}`;
  }
  if (instance.minimum === instance.maximum) {
    return `Required - pick ${instance.minimum}`;
  }
  return `Pick ${instance.minimum}-${instance.maximum}`;
}

export function ModifierGroup({
  instance,
  selections,
  error,
  registerGroup,
  onQuantityChange,
}: ModifierGroupProps) {
  const selected = selections[instance.path] ?? {};
  const selectedCount = Object.values(selected).reduce((total, quantity) => total + quantity, 0);
  const singleChoice = instance.maximum === 1;
  const errorId = `${instance.path.replace(/[^a-z0-9]+/gi, "-")}-error`;

  return (
    <fieldset
      className="modifier-group"
      data-depth={instance.depth}
      data-modifier-group-id={instance.group.id}
      aria-describedby={error ? errorId : undefined}
      ref={registerGroup}
      tabIndex={-1}
    >
      <legend>
        <span>{instance.group.name}</span>
        <small>{ruleLabel(instance)}</small>
      </legend>
      <div className="modifier-options">
        {instance.group.options.map((option) => {
          const quantity = selected[option.id] ?? 0;
          const checked = quantity > 0;
          const maximumQuantity = option.maximumQuantity ?? 1;
          const atGroupMaximum = selectedCount >= instance.maximum;
          const disabled = !option.available || (
            !singleChoice && !checked && atGroupMaximum
          );

          return (
            <div className="modifier-option" key={option.id} data-unavailable={!option.available}>
              <label>
                <span>
                  {option.name}
                  {option.formattedPriceDelta ? (
                    <small>{option.formattedPriceDelta}</small>
                  ) : null}
                  {!option.available ? <small>Unavailable</small> : null}
                </span>
                <input
                  type={singleChoice ? "radio" : "checkbox"}
                  name={singleChoice ? instance.path : undefined}
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    onQuantityChange(instance.path, option.id, checked ? 0 : 1)
                  }
                />
              </label>
              {checked && maximumQuantity > 1 ? (
                <QuantitySelector
                  value={quantity}
                  minimum={1}
                  maximum={Math.min(
                    maximumQuantity,
                    quantity + Math.max(0, instance.maximum - selectedCount),
                  )}
                  label={`${option.name} quantity`}
                  onChange={(value) => onQuantityChange(instance.path, option.id, value)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? (
        <p className="modifier-error" id={errorId}>
          {error.message}
        </p>
      ) : null}
    </fieldset>
  );
}
