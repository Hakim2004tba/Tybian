/**
 * TIBYAN's own accounts, in one place.
 *
 * Defined once so the footer, the contact page and anywhere else that
 * links out cannot drift apart — a stale handle in one corner of a site
 * is the kind of thing nobody notices until a student follows a dead
 * link. Changing an account means changing it here only.
 *
 * `label` is deliberately the same in both languages: these are handles
 * and brand names, not prose, and "يوتيوب" helps nobody find the
 * channel.
 */
export type SocialLink = {
  key: "facebook" | "youtube" | "instagram" | "telegram" | "links";
  href: string;
  label: string;
  /** Used for the accessible name, which does get translated. */
  nameAr: string;
  nameEn: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  {
    key: "facebook",
    /*
      The canonical page URL, not the long one the Share button copies.
      That version carries `rdid` and `share_url` tracking parameters
      tied to a single share event — they identify where the click came
      from, they expire, and they have no business being baked into a
      site's footer.
    */
    href: "https://web.facebook.com/61594072861177",
    label: "Facebook",
    nameAr: "صفحتنا على فيسبوك",
    nameEn: "Our Facebook page",
  },
  {
    key: "youtube",
    href: "https://www.youtube.com/@tybianacademy",
    label: "YouTube",
    nameAr: "قناتنا على يوتيوب",
    nameEn: "Our YouTube channel",
  },
  {
    key: "instagram",
    href: "https://www.instagram.com/tybian.academy/",
    label: "Instagram",
    nameAr: "حسابنا على إنستغرام",
    nameEn: "Our Instagram account",
  },
  {
    key: "telegram",
    href: "https://t.me/tybian_academy",
    label: "Telegram",
    nameAr: "قناتنا على تيليغرام",
    nameEn: "Our Telegram channel",
  },
  {
    key: "links",
    href: "https://tr.ee/rS4Rfb_9au",
    label: "All links",
    nameAr: "كل روابطنا",
    nameEn: "All our links",
  },
];
