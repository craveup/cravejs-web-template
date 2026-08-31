import type { ComponentPropsWithRef } from "react";

function inputClassName(className?: string) {
  return ["storefront-input", className].filter(Boolean).join(" ");
}

export type InputProps = ComponentPropsWithRef<"input">;

export function Input({ className, ...props }: InputProps) {
  return <input {...props} className={inputClassName(className)} />;
}
