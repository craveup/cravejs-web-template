import { redirect } from "next/navigation";

import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";

export default async function Home() {
  const runtime = await readRequestStorefrontRuntime();
  redirect(runtime?.mode === "fixture" ? "/demo" : "/stores");
}
