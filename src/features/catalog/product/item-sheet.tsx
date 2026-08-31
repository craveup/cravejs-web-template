"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { MenuItemCard } from "@/components/ui/menu-item-card";

import type { CatalogItemView } from "../catalog-types";
import {
  createInitialModifierSelections,
  createItemCustomizationIntent,
  getActiveModifierGroups,
  setModifierOptionQuantity,
  validateModifierSelections,
  type ModifierSelections,
} from "./modifier-state";
import { ModifierGroup } from "./modifier-group";
import type {
  ItemDetailView,
  ItemCustomizationIntent,
  ModifierGroupValidationError,
} from "./item-types";

export interface ItemSheetProps {
  item: ItemDetailView;
  similarItems?: CatalogItemView[];
  onSubmit?: (selection: ItemCustomizationIntent) => void | Promise<void>;
  pending?: boolean;
  groupError?: ModifierGroupValidationError;
}

function ItemImage({ item, preload = false }: { item: ItemDetailView; preload?: boolean }) {
  if (!item.imageSrc) return null;
  const discoveryProps = preload
    ? { preload: true }
    : { fetchPriority: "low" as const, loading: "eager" as const };
  return (
    <div className="item-sheet-image">
      <Image
        src={item.imageSrc}
        alt=""
        fill
        sizes="(min-width: 1024px) 590px, 100vw"
        {...discoveryProps}
      />
    </div>
  );
}

function SoldOutItem({ item, similarItems = [] }: Pick<ItemSheetProps, "item" | "similarItems">) {
  return (
    <article className="item-sheet item-sheet-sold-out" data-item-state="sold-out">
      <div className="item-sold-out-content">
        <div className="item-sold-out-product">
          <ItemImage item={item} preload />
          <span className="item-status-badge">Sold out today</span>
          <h1>{item.name}</h1>
          <div className="item-sold-out-details">
            {item.description ? <p>{item.description}</p> : null}
            <strong>{item.formattedPrice}</strong>
          </div>
          <p>{item.unavailableMessage ?? "This item is unavailable right now."}</p>
        </div>
        {similarItems.length ? (
          <section className="similar-items" aria-labelledby="similar-items-title">
            <h2 id="similar-items-title">Similar dishes</h2>
            <div>
              {similarItems.map((similarItem) => (
                <MenuItemCard
                  key={similarItem.id}
                  {...similarItem}
                  layout="list"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <div className="item-sheet-action">
        <Button disabled>
          Unavailable
        </Button>
      </div>
    </article>
  );
}

export function ItemSheet({
  item,
  similarItems,
  onSubmit,
  pending = false,
  groupError,
}: ItemSheetProps) {
  const [selections, setSelections] = useState<ModifierSelections>(() =>
    createInitialModifierSelections(item),
  );
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const groupRefs = useRef(new Map<string, HTMLFieldSetElement>());

  const tree = useMemo(() => getActiveModifierGroups(item, selections), [item, selections]);
  const validationErrors = useMemo(
    () => validateModifierSelections(item, selections),
    [item, selections],
  );
  const firstInvalid = validationErrors.find((error) => error.modifierGroupId !== "item");
  const firstInvalidIndex = firstInvalid
    ? tree.groups.findIndex((instance) => instance.group.id === firstInvalid.modifierGroupId)
    : -1;
  const visibleGroups = firstInvalidIndex >= 0
    ? tree.groups.slice(0, firstInvalidIndex + 1)
    : tree.groups;
  const state = tree.structuralError
    ? "error"
    : firstInvalid
      ? "required-options"
      : "options-selected";

  const focusGroup = useCallback((modifierGroupId: string, message: string) => {
    const instance = tree.groups.find((group) => group.group.id === modifierGroupId);
    const node = instance ? groupRefs.current.get(instance.path) : undefined;
    setAnnouncement(message);
    if (!node) return;

    const reducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    node.focus({ preventScroll: true });
  }, [tree.groups]);

  useEffect(() => {
    if (!groupError) return;
    const timeout = window.setTimeout(() => {
      focusGroup(groupError.modifierGroupId, groupError.message);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [focusGroup, groupError]);

  if (item.availability === "sold-out") {
    return <SoldOutItem item={item} similarItems={similarItems} />;
  }

  function changeOption(path: string, optionId: string, optionQuantity: number) {
    setSelections((current) =>
      setModifierOptionQuantity(item, current, path, optionId, optionQuantity),
    );
    setShowValidation(false);
  }

  async function submit() {
    if (firstInvalid) {
      setShowValidation(true);
      focusGroup(firstInvalid.modifierGroupId, firstInvalid.message);
      return;
    }
    if (!onSubmit || tree.structuralError) return;

    setAnnouncement("");
    try {
      await onSubmit(
        createItemCustomizationIntent(item, quantity, selections, specialInstructions),
      );
    } catch {
      setAnnouncement("The item could not be submitted. Try again.");
    }
  }

  const visibleError = showValidation ? firstInvalid : groupError;
  const invalidGroupName = firstInvalid
    ? tree.groups.find((group) => group.group.id === firstInvalid.modifierGroupId)?.group.name
    : undefined;
  const actionLabel = invalidGroupName
    ? `Choose ${invalidGroupName.replace(/^choose\s+/i, "")} to continue`
    : `Add ${quantity} to order`;
  const submissionUnavailable = !onSubmit || pending || Boolean(tree.structuralError);

  return (
    <article className="item-sheet" data-item-state={state} aria-busy={pending || undefined}>
      <div className="item-sheet-layout">
        <ItemImage item={item} preload={state === "options-selected"} />
        <div className="item-sheet-form">
          <header className="item-sheet-intro">
            <h1>{item.name}</h1>
            {item.description ? <p>{item.description}</p> : null}
            <strong>{item.formattedPrice}</strong>
          </header>

          {tree.structuralError ? (
            <div className="item-data-error" role="alert">
              <h2>This item cannot be configured</h2>
              <p>{tree.structuralError}</p>
            </div>
          ) : (
            <div className="modifier-groups">
              {visibleGroups.map((instance) => (
                <ModifierGroup
                  key={instance.path}
                  instance={instance}
                  selections={selections}
                  error={visibleError?.modifierGroupId === instance.group.id
                    ? visibleError
                    : undefined}
                  registerGroup={(node) => {
                    if (node) groupRefs.current.set(instance.path, node);
                    else groupRefs.current.delete(instance.path);
                  }}
                  onQuantityChange={changeOption}
                />
              ))}
            </div>
          )}

          {!firstInvalid && !tree.structuralError ? (
            <div className="item-order-details">
              <label className="item-special-request">
                <span>Special requests</span>
                <textarea
                  value={specialInstructions}
                  onChange={(event) => setSpecialInstructions(event.target.value)}
                  placeholder="Add a note for the kitchen"
                  rows={3}
                />
              </label>
              <div className="item-quantity-row">
                <span>Quantity</span>
                <QuantitySelector value={quantity} onChange={setQuantity} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="assertive">
        {announcement}
      </p>
      <div className="item-sheet-action">
        <Button
          disabled={submissionUnavailable}
          data-validation-blocked={Boolean(firstInvalid) || undefined}
          onClick={submit}
        >
          {pending ? "Adding item" : actionLabel}
        </Button>
      </div>
    </article>
  );
}
