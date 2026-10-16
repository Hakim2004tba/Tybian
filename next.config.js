/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-hosted on a VPS behind our own Nginx, not Vercel.
  // "standalone" makes `next build` emit a self-contained
  // .next/standalone/ tree carrying only the node_modules actually
  // reachable at runtime — ~60MB to rsync instead of a full install,
  // and the build runs on a dev machine rather than on the server.
  output: "standalone",

  // Without this, Next walks up looking for a workspace root, finds a
  // stray ~/package-lock.json, and roots the standalone tree at the
  // home directory — so server.js lands under
  // .next/standalone/Downloads/<project>/tibyan-app/ instead of at
  // .next/standalone/. Pinning the root to this app keeps the emitted
  // tree flat, which is what the deploy script and systemd expect.
  outputFileTracingRoot: __dirname,

  async headers() {
    return [
      {
        /*
          Hashed build assets, cached for a year.

          THE DOCUMENT RULE THAT USED TO SIT ABOVE THIS IS GONE. It sent
          `no-store, no-transform` on every HTML response, which meant no
          page was ever cached by anything — each visit rebuilt the page
          from scratch. It existed for two Octenium-specific faults: an
          Nginx layer that cached HTML by URL and served the PREVIOUS
          build after every deploy, and another that REWROTE chunk names
          inside server-action payloads and killed the client with "a
          client-side exception has occurred".

          Neither exists on this server. Nginx here is ours, it proxies
          the bytes we emit untouched, and Next's own cache headers are
          correct on their own — so the workaround is removed rather than
          carried forward as cargo.
        */
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },

  images: {
    /*
      Optimization is ON. It was off because the bundle was built on
      macOS and shipped a darwin-only sharp binary that cannot load on
      Linux — every optimized image would have 500'd. sharp is now
      installed ON the server for its own platform (see DEPLOY notes),
      so Next resizes and re-encodes properly and images stop being
      served at full source size.
    */

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
