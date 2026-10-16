"use client";

import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function SignOutButton({
  fullWidth = false,
  onDark = false,
}: {
  fullWidth?: boolean;
  /** Set on the academy.deep rail, where the light `outline` vanishes. */
  onDark?: boolean;
}) {
  const { t } = useI18n();
  /*
    The action clears the session, then the browser leaves the page with
    a full load. It does not redirect server-side: that response comes
    back through a cache on this host and the client cannot parse it —
    the same failure that broke sign-in. See lib/auth/actions.ts.

    window.location.assign, not router.push: after signing out the whole
    tree must be re-fetched anyway, and a full load guarantees no stale
    authenticated markup survives in memory.
  */
  async function signOutThenLeave() {
    await signOutAction();
    window.location.assign("/login");
  }

  return (
    <form action={signOutThenLeave} className={fullWidth ? "w-full" : undefined}>
      <Button
        variant={onDark ? "outlineOnDark" : "outline"}
        size="sm"
        type="submit"
        className={fullWidth ? "w-full justify-center" : undefined}
      >
        <LogOut size={15} />
        {t.dash.common.signOut}
      </Button>
    </form>
  );
}
