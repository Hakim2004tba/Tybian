/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Local, hand-authored SVG illustrations only (course covers, hero
    // art) — no remote/user-uploaded SVGs are served through next/image.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    // Course covers and teacher avatars come from two places: Supabase
    // Storage (the ImageUploadField component) and admin-pasted
    // external URLs on older rows created before that upload widget
    // existed (e.g. a Pinterest/CDN link). A single https wildcard
    // covers both without needing to hardcode this project's specific
    // Supabase ref or maintain an allowlist that breaks every time an
    // admin pastes a link from a new source.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = nextConfig;
