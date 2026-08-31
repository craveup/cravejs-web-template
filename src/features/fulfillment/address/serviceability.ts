import { hasValidCoordinates, type NormalizedAddress } from "../types";

export interface DeliveryPolicy {
  supportedCountryCodes: readonly string[];
  postcodeRequiredCountryCodes: readonly string[];
  deliveryRadiusMiles: number;
  origin: { latitude: number; longitude: number };
  policyLabel: string;
}

export type ServiceabilityResult =
  | { serviceable: true; distanceMiles: number }
  | { serviceable: false; reason: "country" | "postcode" | "coordinates" | "radius" };

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function evaluateServiceability(
  address: NormalizedAddress,
  policy: DeliveryPolicy,
): ServiceabilityResult {
  if (
    !hasValidCoordinates(address) ||
    !hasValidCoordinates(policy.origin)
  ) return { serviceable: false, reason: "coordinates" };

  const countryCode = address.countryCode.trim().toUpperCase();
  if (!policy.supportedCountryCodes.map((code) => code.toUpperCase()).includes(countryCode)) {
    return { serviceable: false, reason: "country" };
  }
  if (
    policy.postcodeRequiredCountryCodes.map((code) => code.toUpperCase()).includes(countryCode) &&
    !address.postcode?.trim()
  ) return { serviceable: false, reason: "postcode" };

  const earthRadiusMiles = 3958.8;
  const latitudeDelta = radians(address.latitude - policy.origin.latitude);
  const longitudeDelta = radians(address.longitude - policy.origin.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(policy.origin.latitude)) *
      Math.cos(radians(address.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  const distanceMiles = earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distanceMiles <= policy.deliveryRadiusMiles
    ? { serviceable: true, distanceMiles }
    : { serviceable: false, reason: "radius" };
}
