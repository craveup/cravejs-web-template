export const storefrontProfiles = [
  "hosted-multitenant",
  "standalone-cli",
] as const;

export type StorefrontProfile = (typeof storefrontProfiles)[number];

const storefrontProfileSet: ReadonlySet<string> = new Set(storefrontProfiles);

export function isStorefrontProfile(
  value: unknown,
): value is StorefrontProfile {
  return typeof value === "string" && storefrontProfileSet.has(value);
}
