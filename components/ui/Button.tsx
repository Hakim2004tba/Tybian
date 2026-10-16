import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "gold" | "outline" | "outlineOnDark" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  gold:
    "bg-gradient-to-br from-gold to-gold-hover text-[#241705] hover:shadow-[0_8px_24px_rgba(232,184,75,0.35)]",
  outline:
    "bg-transparent border border-border-light text-text-primary-light hover:border-primary hover:text-primary dark:border-border-dark dark:text-text-primary-dark",
  ghost: "bg-transparent text-text-secondary-light hover:text-primary",
  /*
    `outline` is drawn for a light page — a grey border and dark text.
    On the academy.deep rail that came out as near-invisible text inside
    a near-invisible box, which is how sign-out looked. This is the same
    shape with the contrast inverted.
  */
  outlineOnDark:
    "bg-white/[0.06] border border-white/20 text-white/90 hover:bg-white/[0.12] hover:border-white/35 hover:text-white",
};

const sizeClasses: Record<Size, string> = {
  md: "px-[22px] py-3 text-[15px] rounded-md",
  sm: "px-3.5 py-2 text-[13px] rounded-sm",
};

/**
 * TIBYAN primary button primitive.
 * Gold is reserved for premium/commerce actions only (subscribe, buy,
 * lifetime plan) — see DESIGN_DECISIONS.md D-002. Do not use `gold` for
 * generic actions.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-0",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
