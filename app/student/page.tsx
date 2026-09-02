import { redirect } from "next/navigation";

/**
 * Was a temporary placeholder from the Authentication-only phase, before
 * the real dashboard existed. Now redirects anyone who still lands here
 * (an old bookmark, a stale link, etc.) straight to /dashboard — the
 * actual built-out student experience.
 */
export default function StudentPlaceholderRedirect() {
  redirect("/dashboard");
}
