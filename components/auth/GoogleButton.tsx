import { isGoogleEnabled } from "@/lib/auth/google";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * "Continue with Google", plus the divider above it.
 *
 * Renders nothing at all when the credentials are not configured. A
 * button that always fails is worse than no button: the student tries
 * it first, it breaks, and they distrust the password form too.
 *
 * A plain link, not a fetch: signing in with Google means leaving the
 * site, and the browser must follow the redirect itself.
 */
export async function GoogleButton() {
  if (!isGoogleEnabled()) return null;

  const { dict } = await getDictionary();

  return (
    <>
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border-light" />
        <span className="text-[11.5px] uppercase tracking-wide text-text-muted-light">
          {dict.auth.orContinueWith}
        </span>
        <span className="h-px flex-1 bg-border-light" />
      </div>

      <a
        href="/api/auth/google"
        className="flex w-full items-center justify-center gap-3 rounded-md border border-border-light bg-white px-4 py-3 text-[14.5px] font-medium text-text-primary-light transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
      >
        {/* Google's own mark, inline so it needs no network request and
            cannot be blocked by a tracker blocker. */}
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
        {dict.auth.continueWithGoogle}
      </a>
    </>
  );
}
