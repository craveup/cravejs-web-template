"use client";

import { Button } from "@/components/ui/button";

export default function StoreError({ reset }: { reset: () => void }) {
  return (
    <main className="route-error" role="alert">
      <h1>We could not load the storefront</h1>
      <p>Try the request again.</p>
      <Button onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
