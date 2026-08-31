import { hasValidCoordinates, type NormalizedAddress } from "../types";

let configuredKey: string | undefined;

async function configureGoogleMaps(apiKey: string) {
  const key = apiKey.trim();
  if (!key) throw new Error("Google Maps is unavailable without a public browser key.");
  const { importLibrary, setOptions } = await import("@googlemaps/js-api-loader");
  if (!configuredKey) {
    setOptions({ key, v: "weekly", authReferrerPolicy: "origin" });
    configuredKey = key;
  } else if (configuredKey !== key) {
    throw new Error("Google Maps was already configured for another browser key.");
  }
  return importLibrary;
}

export async function loadGooglePlaces(apiKey: string) {
  return (await configureGoogleMaps(apiKey))("places");
}

export async function loadGoogleGeocoder(apiKey: string) {
  return (await configureGoogleMaps(apiKey))("geocoding");
}

type AddressPart = Readonly<{
  longText: string;
  shortText: string;
  types: readonly string[];
}>;

function part(parts: readonly AddressPart[], type: string, short = false) {
  const match = parts.find((candidate) => candidate.types.includes(type));
  return match ? (short ? match.shortText : match.longText).trim() : "";
}

function normalizedAddress(input: Readonly<{
  formattedLabel: string;
  parts: readonly AddressPart[];
  latitude: number;
  longitude: number;
}>): NormalizedAddress {
  const streetNumber = part(input.parts, "street_number");
  const route = part(input.parts, "route");
  return {
    formattedLabel: input.formattedLabel.trim(),
    street: [streetNumber, route].filter(Boolean).join(" ") || undefined,
    streetOptional: part(input.parts, "subpremise") || undefined,
    city:
      part(input.parts, "locality") ||
      part(input.parts, "postal_town") ||
      part(input.parts, "administrative_area_level_2") ||
      undefined,
    region: part(input.parts, "administrative_area_level_1", true) || undefined,
    countryCode: part(input.parts, "country", true).toUpperCase(),
    postcode: part(input.parts, "postal_code") || undefined,
    latitude: input.latitude,
    longitude: input.longitude,
  };
}

interface GooglePlace {
  readonly formattedAddress?: string | null;
  readonly location?: Readonly<{ lat(): number; lng(): number }> | null;
  readonly addressComponents?: ReadonlyArray<{
    readonly longText?: string | null;
    readonly shortText?: string | null;
    readonly types: string[];
  }>;
  fetchFields(options: { fields: string[] }): Promise<unknown>;
}

interface GoogleGeocoderResult {
  readonly formatted_address: string;
  readonly address_components: ReadonlyArray<{
    readonly long_name: string;
    readonly short_name: string;
    readonly types: string[];
  }>;
  readonly geometry: Readonly<{
    location: Readonly<{ lat(): number; lng(): number }>;
  }>;
}

interface GoogleAutocompleteSuggestion {
  readonly placePrediction?: Readonly<{ toPlace(): GooglePlace }> | null;
}

function placeAddress(place: GooglePlace): NormalizedAddress {
  const location = place.location;
  const formattedLabel = place.formattedAddress?.trim() ?? "";
  const address = normalizedAddress({
    formattedLabel,
    parts: (place.addressComponents ?? []).map((component) => ({
      longText: component.longText ?? "",
      shortText: component.shortText ?? "",
      types: component.types,
    })),
    latitude: location?.lat() ?? Number.NaN,
    longitude: location?.lng() ?? Number.NaN,
  });
  if (!formattedLabel || !hasValidCoordinates(address)) {
    throw new Error("Google Places returned an incomplete address.");
  }
  return address;
}

function geocoderAddress(result: GoogleGeocoderResult): NormalizedAddress {
  const address = normalizedAddress({
    formattedLabel: result.formatted_address,
    parts: result.address_components.map((component) => ({
      longText: component.long_name,
      shortText: component.short_name,
      types: component.types,
    })),
    latitude: result.geometry.location.lat(),
    longitude: result.geometry.location.lng(),
  });
  if (!address.formattedLabel || !hasValidCoordinates(address)) {
    throw new Error("Google geocoding returned an incomplete address.");
  }
  return address;
}

export interface GooglePlacesAddressAdapter {
  search(query: string): Promise<readonly NormalizedAddress[]>;
  forward(address: string): Promise<NormalizedAddress>;
  reverse(coordinates: {
    latitude: number;
    longitude: number;
  }): Promise<NormalizedAddress>;
}

export function createGooglePlacesAddressAdapter(
  apiKey: string,
  countryCodes: readonly string[],
): GooglePlacesAddressAdapter {
  return {
    async search(query) {
      const { AutocompleteSessionToken, AutocompleteSuggestion } =
        await loadGooglePlaces(apiKey);
      const sessionToken = new AutocompleteSessionToken();
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken,
        ...(countryCodes.length
          ? { includedRegionCodes: countryCodes.map((code) => code.toLowerCase()) }
          : {}),
      });
      const addresses = await Promise.all(
        (suggestions as GoogleAutocompleteSuggestion[])
          .slice(0, 5)
          .map(async ({ placePrediction }) => {
            if (!placePrediction) return null;
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: ["addressComponents", "formattedAddress", "location"],
            });
            return placeAddress(place);
          }),
      );
      return addresses.filter(
        (address: NormalizedAddress | null): address is NormalizedAddress =>
          address !== null,
      );
    },
    async forward(address) {
      const value = address.trim();
      if (!value) throw new Error("An address is required for geocoding.");
      const { Geocoder } = await loadGoogleGeocoder(apiKey);
      const response = await new Geocoder().geocode({
        address: value,
        ...(countryCodes.length === 1
          ? { componentRestrictions: { country: countryCodes[0]!.toLowerCase() } }
          : {}),
      });
      const result = response.results[0];
      if (!result) throw new Error("The address could not be resolved.");
      return geocoderAddress(result as GoogleGeocoderResult);
    },
    async reverse(coordinates) {
      if (!hasValidCoordinates(coordinates)) {
        throw new Error("Current location coordinates are invalid.");
      }
      const { Geocoder } = await loadGoogleGeocoder(apiKey);
      const response = await new Geocoder().geocode({
        location: { lat: coordinates.latitude, lng: coordinates.longitude },
      });
      const result = response.results[0];
      if (!result) throw new Error("Current location did not resolve to an address.");
      return geocoderAddress(result as GoogleGeocoderResult);
    },
  };
}
