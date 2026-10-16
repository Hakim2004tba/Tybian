#!/usr/bin/env bash
#
# Builds TIBYAN locally and assembles an upload-ready folder for
# Octenium shared hosting (cPanel > Setup Node.js App).
#
# Why build here and not on the server: shared hosting caps memory per
# process (typically ~1GB via CloudLinux LVE) and `next build` routinely
# needs more. Building locally sidesteps that limit entirely — the
# server then only *runs* the result.
#
# Usage:  bash scripts/build-deploy.sh
# Output: deploy/  (upload its CONTENTS to your app root on the server)

set -euo pipefail
cd "$(dirname "$0")/.."

OUT="deploy"

echo "==> Cleaning previous output"
rm -rf "$OUT" .next

echo "==> Installing dependencies (exact lockfile versions)"
npm ci

echo "==> Building (output: standalone)"
npm run build

echo "==> Assembling $OUT/"
mkdir -p "$OUT"

# The standalone tree: server.js + the minimal node_modules Next traced.
cp -R .next/standalone/. "$OUT"/

# next build does NOT copy these into standalone — they must be placed
# by hand or every stylesheet, client chunk and image 404s at runtime.
mkdir -p "$OUT/.next"
cp -R .next/static "$OUT/.next/static"

# NOTE THE TRAILING `/.` — standalone already created $OUT/public (it
# carries the uploads directory), so `cp -R public "$OUT/public"` copies
# the source folder INSIDE it and everything lands at public/public/.
# The site then starts fine and silently 404s the logo, the hero images
# and public/pdf/pdf.worker.min.mjs, so every PDF lesson reports "this
# file could not be opened in the browser".
mkdir -p "$OUT/public"
cp -R public/. "$OUT/public"/

# Passenger (what cPanel's Node.js App runs under) looks for a startup
# file at the app root; app.js just hands off to Next's server.
cp scripts/app.js "$OUT/app.js"

# Next traces sharp into the bundle whether or not it is reachable, and
# on this machine that means a darwin-only native binary that would be
# dead weight on the Linux server. images.unoptimized is on (see
# next.config.js), so nothing loads it at runtime — drop it rather than
# upload ~30MB of unusable macOS binaries over FTP.
rm -rf "$OUT/node_modules/sharp" "$OUT/node_modules/@img"

echo
echo "==> Done. Upload the CONTENTS of $OUT/ to your app root on Octenium."
echo "    Size: $(du -sh "$OUT" | cut -f1)"
echo
echo "    Do NOT upload: .env.local (set the variables in cPanel instead)"
