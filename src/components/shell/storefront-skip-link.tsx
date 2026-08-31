export interface StorefrontSkipLinkProps {
  readonly targetId?: string;
  readonly label?: string;
}

export function StorefrontSkipLink({
  targetId = "storefront-main",
  label = "Skip to main content",
}: StorefrontSkipLinkProps) {
  return (
    <a className="skip-link" href={`#${targetId}`}>
      {label}
    </a>
  );
}
