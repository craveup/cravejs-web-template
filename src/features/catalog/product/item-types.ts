export type ItemAvailability = "available" | "sold-out";

export interface ItemModifierGroupLinkView {
  modifierGroupId: string;
  minimum?: number;
  maximum?: number;
  applyPerParentQuantity?: boolean;
}

export interface ItemModifierOptionView {
  id: string;
  name: string;
  formattedPriceDelta?: string;
  available: boolean;
  defaultQuantity?: number;
  maximumQuantity?: number;
  childGroups?: ItemModifierGroupLinkView[];
}

export interface ItemModifierGroupView {
  id: string;
  name: string;
  minimum: number;
  maximum: number;
  options: ItemModifierOptionView[];
}

export interface ItemDetailView {
  id: string;
  name: string;
  description?: string;
  imageSrc?: string;
  formattedPrice: string;
  availability: ItemAvailability;
  unavailableMessage?: string;
  rootModifierGroups: ItemModifierGroupLinkView[];
  modifierGroups: ItemModifierGroupView[];
}

/** UI-owned selection intent. A cart adapter must map this to the published SDK contract. */
export interface ItemModifierSelectionIntent {
  modifierGroupId: string;
  modifierOptionId: string;
  quantity: number;
  childSelections: ItemModifierSelectionIntent[];
}

/** UI-owned customization intent; this is deliberately not an SDK request payload. */
export interface ItemCustomizationIntent {
  productId: string;
  quantity: number;
  specialInstructions?: string;
  modifierSelections: ItemModifierSelectionIntent[];
}

export interface ModifierGroupValidationError {
  modifierGroupId: string;
  message: string;
}
