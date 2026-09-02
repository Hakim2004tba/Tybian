# TIBYAN — Application Shell

This is the global application shell only (layout, navbar, footer, design
tokens, and base UI primitives) built per `/docs/DESIGN_SYSTEM.md`. No
dashboard or course pages are implemented yet — `app/page.tsx` is a
temporary placeholder proving the shell + primitives render correctly.

## Run locally

```bash
npm install
npm run dev
```

## Structure

- `app/layout.tsx` — root layout: RTL, fonts, Navbar + Footer wrapper
- `app/globals.css` — base layer (RTL, typography, focus states, glow utilities)
- `tailwind.config.ts` — design tokens (colors, radius, spacing, shadows) mapped 1:1 from DESIGN_SYSTEM.md
- `config/navigation.ts` — single source of truth for nav links (edit here to change the menu)
- `components/layout/` — Navbar, MobileNav, Footer, Logo, Container
- `components/ui/` — Button, Card, Badge, Input, Skeleton/Spinner
