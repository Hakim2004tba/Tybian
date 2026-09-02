"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/auth/actions";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Thin client wrapper around a Server Action so the surrounding page can
 * stay a Server Component. Renders inline error/success text above the
 * form; the form itself is passed as children via render prop so field
 * markup stays in the (server) page file.
 */
export function AuthForm({
  action,
  children,
  className,
}: {
  action: ServerAction;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {
    error: null,
    success: null,
  });

  return (
    <form action={formAction} className={className} noValidate>
      {state.error && (
        <div
          role="alert"
          className="mb-4 rounded-sm border border-error/30 bg-error/10 px-3.5 py-2.5 text-[13.5px] text-error"
        >
          {state.error}
        </div>
      )}
      {state.success && (
        <div
          role="status"
          className="mb-4 rounded-sm border border-success/30 bg-success/10 px-3.5 py-2.5 text-[13.5px] text-success"
        >
          {state.success}
        </div>
      )}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
