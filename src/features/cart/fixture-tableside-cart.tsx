"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  claimFixtureTablesideCartState,
  fixtureTablesideCartHref,
  fixtureTablesideCartStatesMatch,
  type FixtureTablesideCartState,
} from "@/fixtures/tableside-cart-adapter";

import { CartPage, type CartPageProps } from "./cart-page";

function fixtureLoadingState() {
  return <main aria-busy="true" aria-label="Refreshing cart" />;
}

export function FixtureTablesideCartRecovery({
  fallbackHref,
  locationId,
}: {
  fallbackHref: string;
  locationId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;

      const authoritativeState = claimFixtureTablesideCartState(locationId);
      router.replace(
        authoritativeState
          ? fixtureTablesideCartHref(authoritativeState)
          : fallbackHref,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [fallbackHref, locationId, router]);

  return fixtureLoadingState();
}

export function FixtureTablesideCartGuard({
  expectedState,
  children,
}: {
  readonly expectedState: FixtureTablesideCartState;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const { cartId, locationId, revision, tableIdentifier } = expectedState;
  const expectedStateKey = JSON.stringify([
    locationId,
    cartId,
    tableIdentifier,
    revision,
  ]);
  const [validatedStateKey, setValidatedStateKey] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;

      const authoritativeState = claimFixtureTablesideCartState(locationId);
      const routeState = { cartId, locationId, revision, tableIdentifier };
      if (
        authoritativeState &&
        fixtureTablesideCartStatesMatch(authoritativeState, routeState)
      ) {
        setValidatedStateKey(expectedStateKey);
        return;
      }
      if (authoritativeState) {
        router.replace(fixtureTablesideCartHref(authoritativeState));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    cartId,
    expectedStateKey,
    locationId,
    revision,
    router,
    tableIdentifier,
  ]);

  if (validatedStateKey !== expectedStateKey) {
    return fixtureLoadingState();
  }

  return children;
}

export function FixtureTablesideCart({
  expectedState,
  ...cartPageProps
}: CartPageProps & { expectedState: FixtureTablesideCartState }) {
  return (
    <FixtureTablesideCartGuard expectedState={expectedState}>
      <CartPage {...cartPageProps} />
    </FixtureTablesideCartGuard>
  );
}
