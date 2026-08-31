import type { ReactNode } from "react";

import type { StorefrontPresetId } from "@/presets/storefront-presets";

import { StorefrontSkipLink } from "./storefront-skip-link";

export interface StorefrontShellProps {
  header: ReactNode;
  hero?: ReactNode;
  intro?: ReactNode;
  leading?: ReactNode;
  children: ReactNode;
  rail?: ReactNode;
  stickyAction?: ReactNode;
  variant?: string;
  visualPresetId?: StorefrontPresetId;
}

export function StorefrontShell({
  header,
  hero,
  intro,
  leading,
  children,
  rail,
  stickyAction,
  variant,
  visualPresetId,
}: StorefrontShellProps) {
  return (
    <div
      className="storefront-shell"
      data-testid="storefront-shell"
      data-variant={variant}
      data-preset={visualPresetId}
    >
      <StorefrontSkipLink />
      {header}
      {hero}
      <main className="storefront-main" id="storefront-main" tabIndex={-1}>
        {intro}
        <div className="storefront-grid" data-has-rail={Boolean(rail)}>
          {leading ? <div className="storefront-leading">{leading}</div> : null}
          <div className="storefront-content">{children}</div>
          {rail ? <div className="storefront-rail">{rail}</div> : null}
        </div>
      </main>
      {stickyAction ? <div className="storefront-sticky-action">{stickyAction}</div> : null}
    </div>
  );
}
