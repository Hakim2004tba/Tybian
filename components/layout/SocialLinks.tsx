"use client";

import { Facebook, Youtube, Instagram, Send, LinkIcon } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/social";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/*
  Lucide ships no Telegram mark, so the paper plane stands in for it —
  it is Telegram's own symbol and reads correctly beside the others.
*/
const icons = {
  facebook: Facebook,
  youtube: Youtube,
  instagram: Instagram,
  telegram: Send,
  links: LinkIcon,
} as const;

/**
 * The platform's social accounts as a row of labelled icon buttons.
 *
 * `rel="noopener noreferrer"` on every one: these open in a new tab, and
 * without `noopener` the opened page can reach back through
 * `window.opener` and navigate this tab somewhere else.
 */
export function SocialLinks({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const { locale } = useI18n();

  return (
    <ul className={cn("flex items-center gap-2.5", className)}>
      {SOCIAL_LINKS.map((s) => {
        const Icon = icons[s.key];
        const name = locale === "ar" ? s.nameAr : s.nameEn;
        return (
          <li key={s.key}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              title={name}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                tone === "dark"
                  ? "border-border-dark text-text-muted-dark hover:border-primary hover:bg-primary/10 hover:text-text-primary-dark"
                  : "border-border-light text-text-muted-light hover:border-primary hover:bg-primary/10 hover:text-primary"
              )}
            >
              <Icon size={17} strokeWidth={1.75} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
