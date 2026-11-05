import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export function Button({ children, variant = "primary", className = "", ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }>) {
  return <button {...props} className={`cg-button cg-button-${variant} ${className}`}>{children}</button>;
}
