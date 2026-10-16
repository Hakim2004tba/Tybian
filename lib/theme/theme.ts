import "server-only";
import { cookies } from "next/headers";

/**
 * Which theme to render, read on the server.
 *
 * A cookie rather than localStorage, for the same reason the locale is a
 * cookie: the server has to know before it renders, or the page arrives
 * light and turns dark a moment later. That flash is worst for the
 * person who most wants dark mode, at the time they most want it.
 *
 * Three states, not two. "system" means "follow the device" and is
 * resolved in the browser by ThemeScript — the server cannot know it.
 * An explicit choice wins over the device and persists.
 *
 * LIGHT IS THE DEFAULT, not "system". The platform is read on phones
 * that are often set to dark at night, and a student opening a lecture
 * would get the dark shell without ever having asked for it. Dark mode
 * is a choice here, so it is made deliberately — one press of the
 * toggle, remembered afterwards.
 */
export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "theme";

export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  if (value === "light" || value === "dark" || value === "system") return value;
  return "light";
}
