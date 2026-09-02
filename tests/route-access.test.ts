// Dependency-free unit test for the route-access policy.
// Run with: node --experimental-strip-types tests/route-access.test.ts
// This exercises the EXACT function middleware.ts and requireRole() call —
// see lib/auth/route-access.ts for why that matters.

import { canAccessPath, getRequiredAccess, type AppRole } from "../lib/auth/route-access.ts";

type Case = {
  role: AppRole | null;
  path: string;
  expected: boolean;
};

const roles: (AppRole | null)[] = [null, "student", "teacher", "admin"];

const paths = [
  "/",
  "/courses",
  "/login",
  "/student",
  "/student/courses",
  "/dashboard",
  "/dashboard/courses",
  "/teacher",
  "/teacher/courses",
  "/admin",
  "/admin/courses",
  "/admin/students",
];

// Expected matrix, written out explicitly (not derived from the function
// under test) so the test actually catches a wrong implementation.
const expectedMatrix: Record<string, Record<string, boolean>> = {
  guest: {
    "/": true, "/courses": true, "/login": true,
    "/student": false, "/student/courses": false,
    "/dashboard": false, "/dashboard/courses": false,
    "/teacher": false, "/teacher/courses": false,
    "/admin": false, "/admin/courses": false, "/admin/students": false,
  },
  student: {
    "/": true, "/courses": true, "/login": true,
    "/student": true, "/student/courses": true,
    "/dashboard": true, "/dashboard/courses": true,
    "/teacher": false, "/teacher/courses": false,
    "/admin": false, "/admin/courses": false, "/admin/students": false,
  },
  teacher: {
    "/": true, "/courses": true, "/login": true,
    "/student": true, "/student/courses": true,
    "/dashboard": true, "/dashboard/courses": true,
    "/teacher": true, "/teacher/courses": true,
    "/admin": false, "/admin/courses": false, "/admin/students": false,
  },
  admin: {
    "/": true, "/courses": true, "/login": true,
    "/student": true, "/student/courses": true,
    "/dashboard": true, "/dashboard/courses": true,
    "/teacher": true, "/teacher/courses": true,
    "/admin": true, "/admin/courses": true, "/admin/students": true,
  },
};

function roleKey(role: AppRole | null): string {
  return role === null ? "guest" : role;
}

let pass = 0;
let fail = 0;

for (const role of roles) {
  for (const path of paths) {
    const expected = expectedMatrix[roleKey(role)][path];
    const actual = canAccessPath(role, path);
    const ok = actual === expected;
    ok ? pass++ : fail++;
    const status = ok ? "PASS" : "FAIL";
    if (!ok) {
      console.log(
        `[${status}] role=${roleKey(role).padEnd(7)} path=${path.padEnd(18)} expected=${expected} actual=${actual}`
      );
    }
  }
}

// Sanity checks on getRequiredAccess directly
const requiredChecks: [string, string][] = [
  ["/admin/students", "admin"],
  ["/teacher/courses", "teacher"],
  ["/student/courses", "authenticated"],
  ["/courses", "public"],
];
for (const [path, expected] of requiredChecks) {
  const actual = getRequiredAccess(path);
  const ok = actual === expected;
  ok ? pass++ : fail++;
  if (!ok) {
    console.log(`[FAIL] getRequiredAccess(${path}) expected=${expected} actual=${actual}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) {
  process.exit(1);
}
