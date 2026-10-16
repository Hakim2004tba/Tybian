import { SignedInShell } from "@/components/dashboard/StudentShell";

/**
 * Public route, two chromes.
 *
 * A signed-out visitor gets the marketing navbar and footer from the
 * root layout — this page is still the shareable, indexable one.
 * Anyone signed in keeps the platform rail instead: this page is
 * linked FROM that rail, so losing it here reads as being thrown out
 * of the platform. See SignedInShell for why it is every role and not
 * just students.
 */
export default function ContactSectionLayout({ children }: { children: React.ReactNode }) {
  return <SignedInShell>{children}</SignedInShell>;
}
