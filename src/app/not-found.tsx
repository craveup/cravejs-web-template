import { ButtonLink } from "@/components/ui/button";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";

export default function NotFound() {
  const fixtureRuntime = readFixtureRuntimeFromEnvironment();

  return (
    <main className="route-error">
      <h1>Store not found</h1>
      <p>Check the storefront address and try again.</p>
      <ButtonLink href={fixtureRuntime ? "/demo" : "/"}>
        {fixtureRuntime ? "Open demo store" : "Return home"}
      </ButtonLink>
    </main>
  );
}
