import type {
  ItemDetailView,
  ItemModifierGroupLinkView,
  ItemModifierGroupView,
  ItemModifierOptionView,
  ItemCustomizationIntent,
  ItemModifierSelectionIntent,
  ModifierGroupValidationError,
} from "./item-types";

export type ModifierSelections = Record<string, Record<string, number>>;

export interface ActiveModifierGroup {
  path: string;
  depth: number;
  group: ItemModifierGroupView;
  minimum: number;
  maximum: number;
  quantityFactor: number;
}

export interface ModifierTreeResult {
  groups: ActiveModifierGroup[];
  structuralError?: string;
}

function groupPath(
  parentPath: string,
  link: ItemModifierGroupLinkView,
  index: number,
) {
  return `${parentPath}group:${link.modifierGroupId}:${index}`;
}

function optionPath(parentPath: string, optionId: string) {
  return `${parentPath}/option:${optionId}/`;
}

function effectiveRules(
  group: ItemModifierGroupView,
  link: ItemModifierGroupLinkView,
  parentQuantity: number,
) {
  const quantityFactor = link.applyPerParentQuantity ? parentQuantity : 1;
  return {
    minimum: (link.minimum ?? group.minimum) * quantityFactor,
    maximum: (link.maximum ?? group.maximum) * quantityFactor,
    quantityFactor,
  };
}

function optionCapacity(option: ItemModifierOptionView) {
  return option.maximumQuantity ?? 1;
}

function validateGroupStructure(
  group: ItemModifierGroupView,
  minimum: number,
  maximum: number,
  quantityFactor: number,
) {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum < 0) {
    return `Modifier group ${group.id} has invalid selection rules.`;
  }
  if (minimum > maximum) {
    return `Modifier group ${group.id} requires more selections than it allows.`;
  }

  const availableCapacity = group.options.reduce(
    (total, option) =>
      total + (option.available ? optionCapacity(option) * quantityFactor : 0),
    0,
  );
  if (minimum > availableCapacity) {
    return `Modifier group ${group.id} cannot satisfy its minimum selection rule.`;
  }
  return undefined;
}

function buildGroupMap(item: ItemDetailView) {
  return new Map(item.modifierGroups.map((group) => [group.id, group]));
}

export function getActiveModifierGroups(
  item: ItemDetailView,
  selections: ModifierSelections,
): ModifierTreeResult {
  const groupsById = buildGroupMap(item);
  const groups: ActiveModifierGroup[] = [];

  function visitLinks(
    links: ItemModifierGroupLinkView[],
    parentPath: string,
    depth: number,
    ancestors: Set<string>,
    parentQuantity: number,
  ): string | undefined {
    for (const [index, link] of links.entries()) {
      const group = groupsById.get(link.modifierGroupId);
      if (!group) return `Modifier group ${link.modifierGroupId} is missing.`;
      if (ancestors.has(group.id)) return `Modifier group ${group.id} contains a cycle.`;

      const { minimum, maximum, quantityFactor } = effectiveRules(
        group,
        link,
        parentQuantity,
      );
      const structureError = validateGroupStructure(
        group,
        minimum,
        maximum,
        quantityFactor,
      );
      if (structureError) return structureError;

      const path = groupPath(parentPath, link, index);
      groups.push({
        path,
        depth,
        group,
        minimum,
        maximum,
        quantityFactor,
      });

      const nextAncestors = new Set(ancestors);
      nextAncestors.add(group.id);
      const groupSelections = selections[path] ?? {};
      for (const option of group.options) {
        if ((groupSelections[option.id] ?? 0) <= 0 || !option.childGroups?.length) continue;
        const childError = visitLinks(
          option.childGroups,
          optionPath(path, option.id),
          depth + 1,
          nextAncestors,
          groupSelections[option.id] ?? 1,
        );
        if (childError) return childError;
      }
    }
    return undefined;
  }

  const structuralError = visitLinks(
    item.rootModifierGroups,
    "root/",
    0,
    new Set(),
    1,
  );
  return { groups, structuralError };
}

function selectedCount(selections: ModifierSelections, path: string) {
  return Object.values(selections[path] ?? {}).reduce((total, quantity) => total + quantity, 0);
}

export function validateModifierSelections(
  item: ItemDetailView,
  selections: ModifierSelections,
): ModifierGroupValidationError[] {
  const tree = getActiveModifierGroups(item, selections);
  if (tree.structuralError) {
    return [{ modifierGroupId: "item", message: tree.structuralError }];
  }

  return tree.groups.flatMap((instance) => {
    const count = selectedCount(selections, instance.path);
    if (count < instance.minimum) {
      return [{
        modifierGroupId: instance.group.id,
        message: instance.minimum === 1
          ? `Choose an option for ${instance.group.name}.`
          : `Choose at least ${instance.minimum} options for ${instance.group.name}.`,
      }];
    }
    if (count > instance.maximum) {
      return [{
        modifierGroupId: instance.group.id,
        message: `Choose no more than ${instance.maximum} options for ${instance.group.name}.`,
      }];
    }
    return [];
  });
}

function clearOptionDescendants(
  selections: ModifierSelections,
  path: string,
  optionId: string,
) {
  const prefix = optionPath(path, optionId);
  for (const key of Object.keys(selections)) {
    if (key.startsWith(prefix)) delete selections[key];
  }
}

export function setModifierOptionQuantity(
  item: ItemDetailView,
  selections: ModifierSelections,
  path: string,
  optionId: string,
  requestedQuantity: number,
): ModifierSelections {
  const instance = getActiveModifierGroups(item, selections).groups.find(
    (activeGroup) => activeGroup.path === path,
  );
  if (!instance) return selections;

  const option = instance.group.options.find((candidate) => candidate.id === optionId);
  if (!option || !option.available) return selections;

  const next = Object.fromEntries(
    Object.entries(selections).map(([key, value]) => [key, { ...value }]),
  );
  const currentGroup = { ...(next[path] ?? {}) };
  const currentQuantity = currentGroup[optionId] ?? 0;
  const withoutCurrent = Object.entries(currentGroup).reduce(
    (total, [id, quantity]) => total + (id === optionId ? 0 : quantity),
    0,
  );
  const allowedQuantity = instance.maximum === 1 && requestedQuantity > 0
    ? 1
    : Math.max(
        0,
        Math.min(
          Math.trunc(requestedQuantity),
          optionCapacity(option) * instance.quantityFactor,
          Math.max(0, instance.maximum - withoutCurrent),
        ),
      );

  if (instance.maximum === 1 && allowedQuantity > 0) {
    for (const selectedOptionId of Object.keys(currentGroup)) {
      if (selectedOptionId !== optionId) clearOptionDescendants(next, path, selectedOptionId);
    }
    next[path] = { [optionId]: 1 };
    return next;
  }

  if (allowedQuantity > 0) currentGroup[optionId] = allowedQuantity;
  else delete currentGroup[optionId];
  next[path] = currentGroup;

  if (currentQuantity > 0 && allowedQuantity === 0) {
    clearOptionDescendants(next, path, optionId);
  }
  return next;
}

export function createInitialModifierSelections(item: ItemDetailView): ModifierSelections {
  let selections: ModifierSelections = {};

  for (let pass = 0; pass <= item.modifierGroups.length; pass += 1) {
    const tree = getActiveModifierGroups(item, selections);
    if (tree.structuralError) return selections;
    let changed = false;

    for (const instance of tree.groups) {
      for (const option of instance.group.options) {
        const defaultQuantity = option.available ? (option.defaultQuantity ?? 0) : 0;
        if (defaultQuantity <= 0 || (selections[instance.path]?.[option.id] ?? 0) > 0) continue;
        const next = setModifierOptionQuantity(
          item,
          selections,
          instance.path,
          option.id,
          defaultQuantity,
        );
        if (next !== selections) {
          selections = next;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return selections;
}

function serializeLinks(
  item: ItemDetailView,
  links: ItemModifierGroupLinkView[],
  selections: ModifierSelections,
  parentPath: string,
): ItemModifierSelectionIntent[] {
  const groupsById = buildGroupMap(item);
  return links.flatMap((link, index) => {
    const group = groupsById.get(link.modifierGroupId);
    if (!group) return [];
    const path = groupPath(parentPath, link, index);
    const groupSelections = selections[path] ?? {};

    return group.options.flatMap((option) => {
      const quantity = groupSelections[option.id] ?? 0;
      if (quantity <= 0) return [];
      return [{
        modifierGroupId: group.id,
        modifierOptionId: option.id,
        quantity,
        childSelections: serializeLinks(
          item,
          option.childGroups ?? [],
          selections,
          optionPath(path, option.id),
        ),
      }];
    });
  });
}

export function createItemCustomizationIntent(
  item: ItemDetailView,
  quantity: number,
  selections: ModifierSelections,
  specialInstructions = "",
): ItemCustomizationIntent {
  const normalizedInstructions = specialInstructions.trim();
  return {
    productId: item.id,
    quantity: Math.max(1, Math.trunc(quantity)),
    ...(normalizedInstructions ? { specialInstructions: normalizedInstructions } : {}),
    modifierSelections: serializeLinks(item, item.rootModifierGroups, selections, "root/"),
  };
}
