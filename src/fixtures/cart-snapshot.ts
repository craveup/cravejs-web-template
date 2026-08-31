import type { StorefrontCart } from "@craveup/storefront-sdk";
import { z } from "zod";

import {
  hasExactKeys,
  isNonEmptyStoredString,
  isRecord,
  readSessionRecord,
  removeSessionRecord,
  writeSessionRecord,
} from "@/lib/storefront/session-storage";

const fixtureSnapshotVersion = 1 as const;
const decimal = z.string().regex(/^\d+(?:\.\d{2})$/);
const formattedMoney = z.string().regex(/^\$\d+(?:,\d{3})*(?:\.\d{2})$/);
const nonEmpty = z.string().trim().min(1);

const modifierGroupSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: nonEmpty,
    name: nonEmpty,
    rule: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).strict(),
    items: z.array(
      z.object({
        id: nonEmpty,
        name: nonEmpty,
        price: decimal,
        priceFormatted: z.string(),
        quantity: z.number().int().positive(),
        children: z.array(modifierGroupSchema).optional(),
      }).strict(),
    ),
  }).strict(),
);

const cartItemSchema = z.object({
  id: nonEmpty,
  productId: nonEmpty,
  name: nonEmpty,
  description: z.string(),
  imageUrl: z.string().refine((value) => value.startsWith("/assets/template/")),
  price: decimal,
  priceFormatted: formattedMoney,
  quantity: z.number().int().positive(),
  total: decimal,
  totalFormatted: formattedMoney,
  discount: decimal,
  discountFormatted: formattedMoney,
  categoryId: z.string().nullable(),
  specialInstructions: z.string().max(1_000).optional(),
  itemUnavailableAction: z.enum(["remove_item", "cancel_entire_order"]),
  selections: z.array(modifierGroupSchema),
  product: z.object({
    id: nonEmpty,
    name: z.string().optional(),
    price: decimal.optional(),
  }).strict().optional(),
}).strict();

const feesSchema = z.object({
  enterpriseFeeRate: decimal,
  enterpriseFeeFix: decimal,
  serviceFeeRate: decimal,
  serviceFeeFix: decimal,
  taxRate: z.string().regex(/^\d+(?:\.\d+)?$/),
  tipRate: decimal,
  fulfillmentMethodFeeFix: decimal,
  fulfillmentMethodFeeRate: decimal,
  paymentProcessingFeeRate: decimal,
  paymentProcessingFeeFix: decimal,
}).strict();

const addressSchema = z.object({
  street: nonEmpty,
  streetOptional: z.string().optional(),
  city: nonEmpty,
  state: nonEmpty,
  zipCode: nonEmpty,
  country: z.enum([
    "United States",
    "United Arab Emirates",
    "Australia",
    "United Kingdom",
  ]),
  lat: z.number().finite(),
  lng: z.number().finite(),
}).strict();

const cartSchema = z.object({
  id: nonEmpty,
  locationId: nonEmpty,
  merchantId: z.literal("fixture-merchant"),
  status: z.enum(["OPEN", "LOCKED", "COMPLETED", "EXPIRED"]),
  lockedAt: z.string().nullable().optional(),
  revision: z.number().int().nonnegative(),
  expiresAt: nonEmpty,
  restaurantDisplayName: nonEmpty,
  fulfilmentMethod: z.enum(["takeout", "table_side", "room_service", "delivery"]),
  fulfillmentIdentifier: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  pickupType: z.enum(["ASAP", "LATER"]),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  orderTime: nonEmpty,
  currency: z.enum(["usd", "gbp", "aed", "aud"]),
  subTotal: decimal,
  subTotalFormatted: formattedMoney,
  discountTotal: decimal,
  discountTotalFormatted: formattedMoney,
  waiterTipTotal: decimal,
  waiterTipTotalFormatted: formattedMoney,
  taxTotal: decimal,
  taxTotalFormatted: formattedMoney,
  taxAndFeeTotal: decimal,
  taxAndFeeTotalFormatted: formattedMoney,
  serviceFeeTotal: decimal,
  serviceFeeTotalFormatted: formattedMoney,
  paymentProcessingFeeTotal: decimal,
  paymentProcessingFeeTotalFormatted: formattedMoney,
  applicationFeeTotal: decimal,
  applicationFeeTotalFormatted: formattedMoney,
  netSalesTotal: decimal,
  netSalesTotalFormatted: formattedMoney,
  fulfillmentMethodFeeTotal: decimal,
  fulfillmentMethodFeeTotalFormatted: formattedMoney,
  orderTotal: decimal,
  orderTotalFormatted: formattedMoney,
  orderTotalWithServiceFee: decimal,
  orderTotalWithServiceFeeFormatted: formattedMoney,
  orderTotalWithServiceFeeAmount: z.number().int().nonnegative(),
  enterpriseFeeTotal: decimal,
  enterpriseFeeTotalFormatted: formattedMoney,
  subTotalWithoutDiscount: decimal,
  subTotalWithoutDiscountFormatted: formattedMoney,
  discountCode: z.string().optional(),
  statementDescriptor: nonEmpty,
  totalQuantity: z.number().int().nonnegative(),
  items: z.array(cartItemSchema),
  fees: feesSchema,
  deliveryInfo: z.object({
    addressString: nonEmpty,
    addressData: addressSchema,
  }).strict().nullable().optional(),
  tableServiceInfo: z.object({ tableNumber: z.string().optional() }).strict().nullable().optional(),
  roomServiceInfo: z.object({
    lastName: z.string().optional(),
    roomNumber: z.string().optional(),
  }).strict().nullable().optional(),
}).strict();

interface FixtureCartSnapshotRecord {
  readonly version: typeof fixtureSnapshotVersion;
  readonly merchantSlug: string;
  readonly locationId: string;
  readonly cart: StorefrontCart;
}

export function fixtureCartSnapshotKey(
  merchantSlug: string,
  locationId: string,
): string {
  if (!isNonEmptyStoredString(merchantSlug) || !isNonEmptyStoredString(locationId)) {
    throw new TypeError("Fixture cart snapshot scope must be non-empty.");
  }
  return `craveup:storefront:fixture-cart-snapshot:v1:${encodeURIComponent(merchantSlug)}:${encodeURIComponent(locationId)}`;
}

function isFixtureCartSnapshotRecord(
  value: unknown,
  merchantSlug: string,
  locationId: string,
): value is FixtureCartSnapshotRecord {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["version", "merchantSlug", "locationId", "cart"]) ||
    value.version !== fixtureSnapshotVersion ||
    value.merchantSlug !== merchantSlug ||
    value.locationId !== locationId
  ) {
    return false;
  }
  const parsed = cartSchema.safeParse(value.cart);
  return (
    parsed.success &&
    parsed.data.locationId === locationId &&
    parsed.data.metadata?.source === "canonical-offline-fixture"
  );
}

export function readFixtureCartSnapshot(
  merchantSlug: string,
  locationId: string,
): StorefrontCart | undefined {
  const record = readSessionRecord(
    fixtureCartSnapshotKey(merchantSlug, locationId),
    (value): value is FixtureCartSnapshotRecord =>
      isFixtureCartSnapshotRecord(value, merchantSlug, locationId),
  );
  return record ? structuredClone(record.cart) : undefined;
}

export function writeFixtureCartSnapshot(
  merchantSlug: string,
  cart: StorefrontCart,
): void {
  const parsed = cartSchema.safeParse(cart);
  if (
    !isNonEmptyStoredString(merchantSlug) ||
    !parsed.success ||
    parsed.data.metadata?.source !== "canonical-offline-fixture"
  ) {
    throw new TypeError("Fixture cart snapshot is invalid.");
  }
  writeSessionRecord(
    fixtureCartSnapshotKey(merchantSlug, cart.locationId),
    {
      version: fixtureSnapshotVersion,
      merchantSlug,
      locationId: cart.locationId,
      cart: structuredClone(cart),
    } satisfies FixtureCartSnapshotRecord,
  );
}

export function clearFixtureCartSnapshot(
  merchantSlug: string,
  locationId: string,
): void {
  removeSessionRecord(fixtureCartSnapshotKey(merchantSlug, locationId));
}
