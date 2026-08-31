import type { FixtureRuntime } from "./fixture-runtime";
import styles from "./fixture-mode-banner.module.css";

export function FixtureModeBanner({ runtime }: { runtime: FixtureRuntime }) {
  return (
    <aside className={styles.banner} role="status" aria-live="polite">
      {runtime.label}
    </aside>
  );
}
