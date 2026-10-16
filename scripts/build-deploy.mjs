/**
 * TIBYAN — assembles the folder that gets uploaded to cPanel.
 *
 * Next's standalone output is nearly deployable but not quite: it
 * deliberately does NOT copy `public/` or `.next/static/`, because on a
 * CDN-backed host those are served separately. On cPanel the Node
 * process serves everything, so both have to be placed inside the
 * standalone tree by hand — miss them and the site loads with no CSS, no
 * images and no client JavaScript, which looks like a broken build
 * rather than a missing copy step.
 *
 * Usage:
 *   node scripts/build-deploy.mjs        (expects `next build` already run)
 *
 * Output: deploy/  — upload its CONTENTS to the app root on the server.
 */
import { cp, mkdir, rm, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const standalone = join(appDir, ".next", "standalone");
const deployDir = join(appDir, "deploy");

if (!existsSync(standalone)) {
  console.error("No .next/standalone — run `npx next build` first.");
  process.exit(1);
}

await rm(deployDir, { recursive: true, force: true });
await mkdir(deployDir, { recursive: true });

// 1. The traced server and its node_modules.
await cp(standalone, deployDir, { recursive: true });

// 2. Client-side JS and CSS. Without this every page renders unstyled
//    and interactive components never hydrate.
await cp(join(appDir, ".next", "static"), join(deployDir, ".next", "static"), { recursive: true });

// 3. Static assets — fonts, icons, and the uploads directory that
//    /api/admin/upload writes into at runtime.
/*
  `cp` with recursive merges INTO an existing directory here, which is
  what is wanted: the standalone tree already created deploy/public for
  the uploads directory. Done wrong (shell `cp -R public dst` when dst
  exists) everything lands at public/public/ and the site then silently
  404s the logo, the hero images and public/pdf/pdf.worker.min.mjs —
  every PDF lesson reporting "this file could not be opened".
*/
if (existsSync(join(appDir, "public"))) {
  await mkdir(join(deployDir, "public"), { recursive: true });
  await cp(join(appDir, "public"), join(deployDir, "public"), { recursive: true });
}

/*
  4. The Passenger entry point.

  cPanel's "Setup Node.js App" runs a startup file rather than a command,
  and it does not set PORT — Passenger passes the socket in its own way
  and Next's server reads PORT. Defaulting it here keeps a direct
  `node app.js` working too, which is how you test over SSH before
  wiring up the app in the panel.
*/
await writeFile(
  join(deployDir, "app.js"),
  `/**
 * cPanel / Passenger entry point.
 *
 * Passenger requires a startup FILE, not a command, so this exists to be
 * that file. It only sets defaults and hands over to the standalone
 * server Next generated.
 */
process.env.PORT = process.env.PORT || 3000;
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.env.NODE_ENV = "production";

require("./server.js");
`
);

async function sizeOf(dir) {
  let total = 0;
  let files = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await sizeOf(full);
      total += sub.total;
      files += sub.files;
    } else {
      total += (await stat(full)).size;
      files += 1;
    }
  }
  return { total, files };
}

const { total, files } = await sizeOf(deployDir);

console.log(`deploy/ ready`);
console.log(`  size:  ${(total / 1024 / 1024).toFixed(1)} MB`);
console.log(`  files: ${files.toLocaleString()}  (cPanel inode budget: 200,000)`);
console.log(``);
console.log(`Upload the CONTENTS of deploy/ to the app root on the server,`);
console.log(`then add .env.local there (never commit or upload the local one).`);
