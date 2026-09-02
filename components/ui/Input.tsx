import { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  label?: string;
}

/**
 * Label sits above the input (not side-by-side) — see DESIGN_SYSTEM.md §13,
 * this sidesteps RTL label-alignment ambiguity. Icon sits at the reading-
 * start side, which is the right edge in RTL.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, label, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-[13.5px] font-semibold">
            {label}
          </label>
        )}
        <div className="flex items-center gap-2 rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]">
          {icon && <span className="shrink-0 text-text-muted-light">{icon}</span>}
          <input
            ref={ref}
            id={id}
            className={cn(
              "flex-1 bg-transparent text-[14.5px] text-text-primary-light outline-none placeholder:text-text-muted-light",
              className
            )}
            {...props}
          />
        </div>
      </div>
    );
  }
);
Input.displayName = "Input";
