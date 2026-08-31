export const fixtureNowIso = "2026-08-10T18:00:00.000Z" as const;

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const fixtureNowMs = Date.parse(fixtureNowIso);

function isoAtOffset(offsetMs: number): string {
  return new Date(fixtureNowMs + offsetMs).toISOString();
}

function dateAtOffset(offsetDays: number): string {
  return isoAtOffset(offsetDays * dayMs).slice(0, 10);
}

export const fixtureTimeline = {
  now: fixtureNowIso,
  cartExpiresAt: isoAtOffset(hourMs),
  expiredCartExpiresAt: isoAtOffset(-hourMs),
  checkoutExpiredAt: isoAtOffset(-minuteMs),
  checkoutExpiresAt: isoAtOffset(15 * minuteMs),
  primaryOrderCreatedAt: fixtureNowIso,
  primaryOrderUpdatedAt: isoAtOffset(hourMs),
  secondaryOrderCreatedAt: isoAtOffset(-7 * dayMs),
  cancelledOrderCreatedAt: isoAtOffset(-14 * dayMs),
  addressCreatedAt: isoAtOffset(-30 * dayMs),
  loyaltyEntryOccurredAt: isoAtOffset(-2 * dayMs),
} as const;

export const fixtureCalendar = {
  cartOrderDate: dateAtOffset(0),
  secondaryOrderDate: dateAtOffset(-7),
  cancelledOrderDate: dateAtOffset(-14),
} as const;
