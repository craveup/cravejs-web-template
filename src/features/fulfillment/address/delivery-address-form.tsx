"use client";

import type { DeliveryAddress, StorefrontCart } from "@craveup/storefront-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toSdkDeliveryAddress } from "../sdk-contract";
import type { NormalizedAddress } from "../types";
import { AddressResults } from "./address-results";
import {
  createGooglePlacesAddressAdapter,
  loadGooglePlaces,
} from "./google-places";
import { evaluateServiceability, type DeliveryPolicy } from "./serviceability";
import styles from "./delivery-address-form.module.css";

const coordinateSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z.coerce.number({ error: "Address verification failed." }).finite().optional(),
);

const addressSchema = z.object({
  formattedLabel: z.string().trim().min(1, "Enter an address."),
  street: z.string().trim().min(1, "Enter a street address."),
  streetOptional: z.string().trim().optional(),
  city: z.string().trim().min(1, "Enter a city."),
  region: z.string().trim().min(1, "Enter a state or region."),
  latitude: coordinateSchema,
  longitude: coordinateSchema,
  countryCode: z.string().trim().length(2, "Use a two-letter country code."),
  postcode: z.string().trim().optional(),
});

type AddressFields = z.input<typeof addressSchema>;

export interface DeliveryAddressSubmission {
  normalizedAddress: NormalizedAddress;
  sdkAddress: DeliveryAddress;
}

export interface DeliveryAddressFormProps {
  policy: DeliveryPolicy;
  initialQuery?: string;
  initialResults?: readonly NormalizedAddress[];
  googleMapsApiKey?: string;
  searchAddresses?: (query: string) => Promise<readonly NormalizedAddress[]>;
  resolveCurrentLocation?: (coordinates: {
    latitude: number;
    longitude: number;
  }) => Promise<NormalizedAddress>;
  resolveManualAddress?: (address: string) => Promise<NormalizedAddress>;
  onSubmitAddress?: (
    submission: DeliveryAddressSubmission,
  ) => StorefrontCart | Promise<StorefrontCart>;
}

function mutationErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code === "CART_CONFLICT") {
    return "Your order changed. Review the refreshed cart, then choose the address again.";
  }
  if (code === "CART_EXPIRED" || code === "NOT_FOUND") {
    return "Your ordering session expired. Return to the menu to start again.";
  }
  if (code === "CART_IMMUTABLE") {
    return "This order can no longer be changed.";
  }
  if (code === "RATE_LIMITED") {
    return "Address updates are temporarily limited. Wait a moment and try again.";
  }
  if (code === "IDEMPOTENCY_IN_PROGRESS") {
    return "The previous address update is still processing. Check it before choosing another address.";
  }
  if (code === "VALIDATION_ERROR") {
    return "The address was not accepted. Review the fields and try again.";
  }
  return "Address could not be saved. Review it and try again.";
}

export function DeliveryAddressForm({
  policy,
  initialQuery = "",
  initialResults = [],
  googleMapsApiKey,
  searchAddresses,
  resolveCurrentLocation,
  resolveManualAddress,
  onSubmitAddress,
}: DeliveryAddressFormProps) {
  const places = useMemo(
    () =>
      googleMapsApiKey
        ? createGooglePlacesAddressAdapter(
            googleMapsApiKey,
            policy.supportedCountryCodes,
          )
        : undefined,
    [googleMapsApiKey, policy.supportedCountryCodes],
  );
  const searchAdapter = searchAddresses ?? places?.search;
  const locationAdapter = resolveCurrentLocation ?? places?.reverse;
  const manualAdapter = resolveManualAddress ?? places?.forward;
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<readonly NormalizedAddress[]>(initialResults);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAvailable, setManualAvailable] = useState(!searchAdapter);
  const [status, setStatus] = useState(() =>
    initialResults.length
      ? `${initialResults.length} address results.`
      : searchAdapter
        ? "Address search is ready."
        : "Address search is unavailable; manual entry remains available.",
  );
  const [pending, setPending] = useState(false);
  const searchRequest = useRef(0);
  const searchTimeout = useRef<number | undefined>(undefined);
  const schema = useMemo(
    () =>
      addressSchema.superRefine((value, context) => {
        if (
          typeof value.latitude !== "number" ||
          typeof value.longitude !== "number"
        ) {
          return;
        }
        const result = evaluateServiceability(
          {
            formattedLabel: value.formattedLabel,
            latitude: value.latitude,
            longitude: value.longitude,
            countryCode: value.countryCode,
            postcode: value.postcode,
          },
          policy,
        );
        if (!result.serviceable) {
          const issue = {
            country: {
              message: `Address country is not supported by ${policy.policyLabel}.`,
              path: ["countryCode"],
            },
            postcode: {
              message: `Postcode is required by ${policy.policyLabel}.`,
              path: ["postcode"],
            },
            coordinates: { message: "Address verification failed.", path: ["formattedLabel"] },
            radius: {
              message: `Address is outside ${policy.policyLabel}.`,
              path: ["formattedLabel"],
            },
          }[result.reason];
          context.addIssue({ code: "custom", message: issue.message, path: issue.path });
        }
      }),
    [policy],
  );
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AddressFields>({
    resolver: zodResolver(schema),
    defaultValues: {
      formattedLabel: "",
      street: "",
      streetOptional: "",
      city: "",
      region: "",
      countryCode: "",
      postcode: "",
    },
  });

  useEffect(() => {
    if (!googleMapsApiKey || searchAddresses) return;
    let active = true;
    void loadGooglePlaces(googleMapsApiKey).then(
      () => active && setStatus("Address search is ready."),
      () => {
        if (!active) return;
        setManualAvailable(true);
        setStatus("Address search is unavailable; manual entry remains available.");
      },
    );
    return () => {
      active = false;
    };
  }, [googleMapsApiKey, searchAddresses]);

  useEffect(() => {
    searchRequest.current += 1;
    if (!searchAdapter || query.trim().length < 3 || query === initialQuery) return;
    searchTimeout.current = window.setTimeout(() => {
      searchTimeout.current = undefined;
      void runSearch(query);
    }, 300);
    return () => {
      if (searchTimeout.current !== undefined) {
        window.clearTimeout(searchTimeout.current);
        searchTimeout.current = undefined;
      }
    };
    // runSearch intentionally follows the latest query and injected adapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchAdapter, initialQuery]);

  async function runSearch(value = query) {
    if (!searchAdapter || !value.trim()) {
      setManualAvailable(true);
      setStatus("Address suggestions are unavailable; enter the address manually.");
      return;
    }
    const request = searchRequest.current + 1;
    searchRequest.current = request;
    setPending(true);
    try {
      const next = await searchAdapter(value.trim());
      if (request !== searchRequest.current) return;
      setResults(next);
      if (next.length === 0) setManualAvailable(true);
      setStatus(next.length ? `${next.length} address results.` : "No matching addresses.");
    } catch {
      if (request !== searchRequest.current) return;
      setManualAvailable(true);
      setStatus("Address search is temporarily unavailable; enter the address manually.");
    } finally {
      if (request === searchRequest.current) setPending(false);
    }
  }

  function choose(address: NormalizedAddress) {
    setValue("formattedLabel", address.formattedLabel, { shouldValidate: true });
    setValue("street", address.street ?? "", { shouldValidate: true });
    setValue("streetOptional", address.streetOptional ?? "", { shouldValidate: true });
    setValue("city", address.city ?? "", { shouldValidate: true });
    setValue("region", address.region ?? "", { shouldValidate: true });
    setValue("latitude", address.latitude, { shouldValidate: true });
    setValue("longitude", address.longitude, { shouldValidate: true });
    setValue("countryCode", address.countryCode, { shouldValidate: true });
    setValue("postcode", address.postcode ?? "", { shouldValidate: true });
    setManualOpen(true);
    setStatus("Address selected. Review and continue.");
  }

  function locate() {
    if (!locationAdapter || typeof navigator === "undefined" || !navigator.geolocation) {
      setManualAvailable(true);
      setStatus("Current location is unavailable; enter the address manually.");
      return;
    }
    setPending(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          choose(
            await locationAdapter({
              latitude: coords.latitude,
              longitude: coords.longitude,
            }),
          );
        } catch {
          setManualAvailable(true);
          setStatus("Current location could not be resolved; enter the address manually.");
        } finally {
          setPending(false);
        }
      },
      () => {
        setPending(false);
        setManualAvailable(true);
        setStatus("Location permission was denied; enter the address manually.");
      },
    );
  }

  const submit = handleSubmit(async (values) => {
    if (!onSubmitAddress) {
      setStatus("Address saving is unavailable until an ordering session is active.");
      return;
    }
    let address: NormalizedAddress = {
      formattedLabel: values.formattedLabel.trim(),
      street: values.street.trim(),
      streetOptional: values.streetOptional?.trim() || undefined,
      city: values.city.trim(),
      region: values.region.trim(),
      latitude:
        typeof values.latitude === "number" ? values.latitude : Number.NaN,
      longitude:
        typeof values.longitude === "number" ? values.longitude : Number.NaN,
      countryCode: values.countryCode.trim().toUpperCase(),
      postcode: values.postcode?.trim() || undefined,
    };
    if (!Number.isFinite(address.latitude) || !Number.isFinite(address.longitude)) {
      if (!manualAdapter) {
        setStatus(
          "This address cannot be verified right now. Search for and select an address to continue.",
        );
        return;
      }
      try {
        address = await manualAdapter(
          [
            address.street,
            address.streetOptional,
            address.city,
            address.region,
            address.postcode,
            address.countryCode,
          ].filter(Boolean).join(", "),
        );
      } catch {
        setStatus(
          "This address could not be verified. Review the details or select a search result.",
        );
        return;
      }
      const serviceability = evaluateServiceability(address, policy);
      if (!serviceability.serviceable) {
        setStatus(
          serviceability.reason === "radius"
            ? `Address is outside ${policy.policyLabel}.`
            : `This address is not supported by ${policy.policyLabel}.`,
        );
        return;
      }
    }
    const conversion = toSdkDeliveryAddress(address);
    if (!conversion.ready) {
      setStatus(
        conversion.reason === "unsupported-country"
          ? "This country is not supported by the storefront delivery contract."
          : "Complete the structured delivery address before continuing.",
      );
      return;
    }
    setPending(true);
    try {
      const cart = await onSubmitAddress({
        normalizedAddress: address,
        sdkAddress: conversion.address,
      });
      if (
        cart.fulfilmentMethod !== "delivery" ||
        !cart.deliveryInfo?.addressData ||
        !cart.deliveryInfo.addressString.trim()
      ) {
        setStatus("The cart response did not confirm the delivery address. Refresh and try again.");
        return;
      }
      setStatus(`Delivery to ${cart.deliveryInfo.addressString} was confirmed by the current cart.`);
    } catch (error) {
      setStatus(mutationErrorMessage(error));
    } finally {
      setPending(false);
    }
  });

  return (
    <main className={styles.surface} aria-busy={pending}>
      <h1>Where should we deliver?</h1>
      {!manualOpen ? (
        <div className={styles.form}>
          <form
            className={styles.searchForm}
            onSubmit={(event) => {
              event.preventDefault();
              if (searchTimeout.current !== undefined) {
                window.clearTimeout(searchTimeout.current);
                searchTimeout.current = undefined;
              }
              void runSearch();
            }}
          >
            <label className={styles.field}>
              Delivery address
              <input
                value={query}
                onChange={(event) => {
                  searchRequest.current += 1;
                  setPending(false);
                  setQuery(event.target.value);
                }}
                autoComplete="street-address"
                placeholder="Street address or postcode"
              />
            </label>
          </form>
          {results.length ? (
            <AddressResults results={results} onSelect={choose} />
          ) : (
            <>
              <button
                className={styles.locationAction}
                type="button"
                onClick={locate}
                disabled={pending || !locationAdapter}
              >
                <span aria-hidden="true" />
                Use my current location
              </button>
              <p className={styles.eyebrow}>RECENT</p>
              <p className={styles.empty}>Nothing yet — your recent addresses will show up here.</p>
            </>
          )}
          {manualAvailable ? (
            <button
              className={styles.manualToggle}
              type="button"
              onClick={() => setManualOpen(true)}
            >
              Enter address manually
            </button>
          ) : null}
          <div className={styles.continuation}>
            <button type="button" disabled>
              {results.length ? "Pick an address to continue" : "Enter an address to continue"}
            </button>
          </div>
        </div>
      ) : (
        <form className={styles.manual} onSubmit={submit} noValidate>
          <label className={styles.field}>
            Formatted address
            <input
              {...register("formattedLabel")}
              aria-invalid={Boolean(errors.formattedLabel)}
              aria-describedby={errors.formattedLabel ? "formatted-address-error" : undefined}
            />
            {errors.formattedLabel ? <span className={styles.error} id="formatted-address-error">{errors.formattedLabel.message}</span> : null}
          </label>
          <label className={styles.field}>
            Street address
            <input autoComplete="address-line1" {...register("street")} aria-invalid={Boolean(errors.street)} aria-describedby={errors.street ? "street-address-error" : undefined} />
            {errors.street ? <span className={styles.error} id="street-address-error">{errors.street.message}</span> : null}
          </label>
          <label className={styles.field}>Apartment, suite, or unit<input autoComplete="address-line2" {...register("streetOptional")} /></label>
          <label className={styles.field}>
            City
            <input autoComplete="address-level2" {...register("city")} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? "city-error" : undefined} />
            {errors.city ? <span className={styles.error} id="city-error">{errors.city.message}</span> : null}
          </label>
          <label className={styles.field}>
            State or region
            <input autoComplete="address-level1" {...register("region")} aria-invalid={Boolean(errors.region)} aria-describedby={errors.region ? "region-error" : undefined} />
            {errors.region ? <span className={styles.error} id="region-error">{errors.region.message}</span> : null}
          </label>
          <input type="hidden" {...register("latitude")} />
          <input type="hidden" {...register("longitude")} />
          <label className={styles.field}>
            Country code
            <input autoCapitalize="characters" {...register("countryCode")} aria-invalid={Boolean(errors.countryCode)} aria-describedby={errors.countryCode ? "country-code-error" : undefined} />
            {errors.countryCode ? <span className={styles.error} id="country-code-error">{errors.countryCode.message}</span> : null}
          </label>
          <label className={styles.field}>
            Postcode
            <input autoComplete="postal-code" {...register("postcode")} aria-invalid={Boolean(errors.postcode)} aria-describedby={errors.postcode ? "postcode-error" : undefined} />
            {errors.postcode ? <span className={styles.error} id="postcode-error">{errors.postcode.message}</span> : null}
          </label>
          <div className={styles.continuation}>
            <button type="submit" disabled={pending || !onSubmitAddress}>Use this address</button>
          </div>
        </form>
      )}
      <p className={styles.status} role="status" aria-live="polite">{status}</p>
    </main>
  );
}
