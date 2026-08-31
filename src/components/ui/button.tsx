import Link, { type LinkProps } from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
} from "react";

function buttonClassName(className?: string) {
  return ["primary-button", className].filter(Boolean).join(" ");
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={buttonClassName(className)}
      type={type}
    />
  );
}

export interface ButtonLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "href"> {
  href: LinkProps["href"];
}

export function ButtonLink({ className, ...props }: ButtonLinkProps) {
  return <Link {...props} className={buttonClassName(className)} />;
}
