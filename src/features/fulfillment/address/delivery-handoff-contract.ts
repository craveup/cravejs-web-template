import type { StorefrontCart, UpdateCartPayload } from "@craveup/storefront-sdk";

type CartNoteIsReadable = "note" extends keyof StorefrontCart ? true : false;
type CartNoteIsWritable = { note: string } extends UpdateCartPayload ? true : false;

const cartNoteIsReadable: CartNoteIsReadable = false;
const cartNoteIsWritable: CartNoteIsWritable = true;

/**
 * SDK 2.0.1 accepts a note update, but its returned cart has no readable note and
 * the public contract does not define an explicit clear round-trip. Presentation
 * must therefore keep the field disabled until a later accepted contract supplies
 * all three capabilities.
 */
export const publishedDeliveryHandoffContract = {
  handoffMethod: {
    writable: false,
  },
  note: {
    writable: cartNoteIsWritable,
    readable: cartNoteIsReadable,
    clearable: false,
  },
} as const;
