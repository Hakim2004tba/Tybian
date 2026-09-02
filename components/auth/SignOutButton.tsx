"use client";

import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button variant="outline" size="sm" type="submit">
        <LogOut size={15} />
        تسجيل الخروج
      </Button>
    </form>
  );
}
