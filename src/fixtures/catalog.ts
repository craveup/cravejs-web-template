import type {
  Menu,
  MenuBundle,
  MenuProduct,
  Modifier,
  Product,
} from "@craveup/storefront-sdk";

import { fixtureLocation } from "./location";

const asset = "/assets/template/menu-item.svg";

export const fixtureMenuProducts = [
  {
    id: "double-smash-burger",
    name: "Double smash burger",
    price: "12.50",
    displayPrice: "$12.50",
    currency: "usd",
    modifierIds: ["choose-a-side", "add-extras"],
    description: "Two seared patties, American cheese, onion, pickle.",
    availability: "available",
    images: [asset],
    nutrition: {
      calorieCount: 780,
      dietaryPreferences: [],
      ingredients: ["beef", "cheese", "bun", "house sauce"],
    },
  },
  {
    id: "crispy-chicken-sandwich",
    name: "Crispy chicken sandwich",
    price: "11.50",
    displayPrice: "$11.50",
    currency: "usd",
    modifierIds: [],
    description: "Buttermilk dredge, pickles, toasted bun.",
    availability: "available",
    images: [asset],
  },
  {
    id: "mushroom-burger",
    name: "Mushroom burger",
    price: "13.00",
    displayPrice: "$13.00",
    currency: "usd",
    modifierIds: ["choose-a-side"],
    description: "Roasted mushrooms, melted cheese, house sauce.",
    availability: "unavailable",
    images: [asset],
  },
  {
    id: "crinkle-fries",
    name: "Crinkle fries",
    price: "4.50",
    displayPrice: "$4.50",
    currency: "usd",
    modifierIds: [],
    description: "Sea salt, crisp edges, served hot.",
    availability: "available",
    images: [asset],
  },
  {
    id: "side-salad",
    name: "Side salad",
    price: "5.50",
    displayPrice: "$5.50",
    currency: "usd",
    modifierIds: [],
    description: "Little gem, lemon, shaved cheese.",
    availability: "available",
    images: [asset],
  },
  {
    id: "chocolate-malt",
    name: "Chocolate malt",
    price: "6.00",
    displayPrice: "$6.00",
    currency: "usd",
    modifierIds: [],
    description: "Thick vanilla malt, spoon required.",
    availability: "available",
    images: [asset],
  },
] satisfies MenuProduct[];

const productsById = new Map(
  fixtureMenuProducts.map((product) => [product.id, product]),
);

function menuProduct(id: string): MenuProduct {
  const product = productsById.get(id);
  if (!product) throw new Error(`Missing canonical fixture product: ${id}`);
  return product;
}

const saladDressingModifier = {
  id: "salad-dressing",
  name: "Choose a dressing",
  description: "Choose one dressing.",
  rule: { min: 0, max: 1 },
  items: [
    {
      id: "lemon-vinaigrette",
      name: "Lemon vinaigrette",
      price: "0.00",
      maxQuantity: 1,
    },
    { id: "ranch", name: "Ranch", price: "0.00", maxQuantity: 1 },
  ],
} satisfies Modifier;

const chooseSideModifier = {
  id: "choose-a-side",
  name: "Choose a side",
  description: "Choose one side.",
  rule: { min: 1, max: 1 },
  items: [
    {
      id: "crinkle-fries",
      name: "Crinkle fries",
      price: "0.00",
      maxQuantity: 1,
    },
    {
      id: "waffle-fries",
      name: "Waffle fries",
      price: "1.00",
      maxQuantity: 1,
    },
    {
      id: "side-salad",
      name: "Side salad",
      price: "2.00",
      maxQuantity: 1,
      childGroups: [
        {
          groupId: saladDressingModifier.id,
          overrides: { min: 1, max: 1 },
          group: saladDressingModifier,
        },
      ],
    },
    {
      id: "no-side",
      name: "No side",
      price: "0.00",
      maxQuantity: 1,
    },
  ],
} satisfies Modifier;

const addExtrasModifier = {
  id: "add-extras",
  name: "Add extras",
  description: "Optional additions.",
  rule: { min: 0, max: 3 },
  items: [
    {
      id: "extra-patty",
      name: "Extra patty",
      price: "3.50",
      maxQuantity: 2,
    },
    { id: "bacon", name: "Bacon", price: "2.00", maxQuantity: 1 },
    {
      id: "no-pickles",
      name: "No pickles",
      price: "0.00",
      maxQuantity: 1,
    },
  ],
} satisfies Modifier;

function productDetail(
  id: string,
  modifiers: Modifier[] = [],
): Product {
  const product = menuProduct(id);
  return {
    ...product,
    locationId: fixtureLocation.id,
    availability: product.availability ?? "available",
    images: product.images ?? [],
    modifiers,
  };
}

export const fixtureProductsById = {
  "double-smash-burger": productDetail("double-smash-burger", [
    chooseSideModifier,
    addExtrasModifier,
  ]),
  "crispy-chicken-sandwich": productDetail("crispy-chicken-sandwich"),
  "mushroom-burger": productDetail("mushroom-burger", [chooseSideModifier]),
  "crinkle-fries": productDetail("crinkle-fries"),
  "side-salad": productDetail("side-salad"),
  "chocolate-malt": productDetail("chocolate-malt"),
} satisfies Record<string, Product>;

export const fixtureMenu = {
  id: "fixture-all-day-menu",
  name: "All day menu",
  isActive: true,
  time: "11:00 AM - 10:00 PM",
  imageUrl: asset,
  categories: [
    {
      id: "burgers",
      name: "Burgers",
      products: [
        menuProduct("double-smash-burger"),
        menuProduct("crispy-chicken-sandwich"),
        menuProduct("mushroom-burger"),
      ],
    },
    {
      id: "sides",
      name: "Sides",
      products: [menuProduct("crinkle-fries"), menuProduct("side-salad")],
    },
    {
      id: "drinks",
      name: "Drinks",
      products: [menuProduct("chocolate-malt")],
    },
  ],
} satisfies Menu;

const fixtureAdditionalMenus = [
  {
    id: "fixture-lunch-menu",
    name: "Lunch",
    isActive: true,
    time: "11:00 AM - 2:00 PM",
    imageUrl: asset,
    categories: [],
  },
  {
    id: "fixture-cocktails-menu",
    name: "Cocktails",
    isActive: true,
    time: "11:00 AM - 10:00 PM",
    imageUrl: asset,
    categories: [],
  },
  {
    id: "fixture-wines-menu",
    name: "Wines",
    isActive: true,
    time: "11:00 AM - 6:45 PM",
    imageUrl: asset,
    categories: [],
  },
  {
    id: "fixture-beers-menu",
    name: "Beers & seltzers",
    isActive: true,
    time: "11:00 AM - 6:45 PM",
    imageUrl: asset,
    categories: [],
  },
  {
    id: "fixture-desserts-menu",
    name: "Desserts",
    isActive: true,
    time: "11:00 AM - 6:45 PM",
    imageUrl: asset,
    categories: [],
  },
] satisfies Menu[];

export const fixtureMenuBundle = {
  menus: [fixtureMenu, ...fixtureAdditionalMenus],
  popularProducts: [
    menuProduct("double-smash-burger"),
    menuProduct("crispy-chicken-sandwich"),
    menuProduct("crinkle-fries"),
  ],
} satisfies MenuBundle;
