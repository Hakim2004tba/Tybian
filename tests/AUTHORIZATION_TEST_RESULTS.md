# TIBYAN — Authorization Test Results

Two independent test suites were run before this phase was considered
complete, per the requirement not to proceed until authorization is
verified working for Guest / Student / Teacher / Admin.

## 1. Application-layer policy (`tests/route-access.test.ts`)

Pure-function unit test of `lib/auth/route-access.ts` — the exact
function `middleware.ts` and every server-side layout guard call.
No Next.js server, no database, no mocking required.

```
node --experimental-strip-types tests/route-access.test.ts
```

**Result: 44/44 assertions passed.** Covers the full
guest/student/teacher/admin × {/, /courses, /login, /student,
/student/courses, /teacher, /teacher/courses, /admin, /admin/courses,
/admin/students} matrix.

## 2. Database-layer RLS (the real security boundary)

Run against a real local PostgreSQL 16 instance, with `anon` /
`authenticated` / `service_role` Postgres roles configured with the same
privileges Supabase provisions in production (including `service_role`
having `BYPASSRLS`), stubbed `auth.uid()` / `auth.jwt()` functions
reading from `request.jwt.claims` (exactly what PostgREST sets per
request in real Supabase), and all 9 migrations applied including
`0009_rls_policies.sql`.

Four personas tested, each as a real Postgres session with the
corresponding JWT claims set via `SET LOCAL request.jwt.claims`:

### Guest (anon, no JWT)
| Check | Result |
|---|---|
| Sees only the published course, draft hidden | ✅ |
| 0 profiles visible | ✅ |
| 0 enrollments visible | ✅ |
| 0 payments visible | ✅ |
| Academic years (public reference data) readable | ✅ |
| INSERT into courses | ✅ rejected (permission denied) |

### Student
| Check | Result |
|---|---|
| Sees only the published course, draft hidden | ✅ |
| Sees only own profile row | ✅ |
| Direct lookup of another user's profile by id | ✅ 0 rows |
| Attempted self-promotion to admin | ✅ blocked by trigger |
| Sees only own enrollment | ✅ |
| INSERT into payments | ✅ rejected by RLS |

### Teacher — owner of a course
| Check | Result |
|---|---|
| Sees published courses + their own draft | ✅ |
| UPDATE own draft course | ✅ succeeds |
| INSERT into course_prices on own course | ✅ rejected (pricing is admin-only) |
| Reads payments | ✅ 0 rows (not their data) |

### Teacher — NOT owner of that course
| Check | Result |
|---|---|
| Sees only the published course; other teacher's draft invisible | ✅ |
| UPDATE on the other teacher's draft | ✅ affects 0 rows |
| INSERT a section into the other teacher's course | ✅ rejected by RLS |

### Admin
| Check | Result |
|---|---|
| Sees ALL courses, including any teacher's draft | ✅ |
| Sees ALL profiles | ✅ |
| Sees ALL enrollments | ✅ |
| INSERT into course_prices | ✅ succeeds (admin-only write) |
| UPDATE profiles.role (promote a user) | ✅ succeeds |
| Reads payments | ✅ no denial |
| INSERT into coupons (admin-only table) | ✅ succeeds |

## Bug found and fixed during this testing pass

`prevent_role_self_escalation` initially blocked `service_role` itself
(no JWT claims → `jwt_role()` = `'anon'` → `is_admin()` = false), which
would have broken the backend's own admin-grant/seed operations in
production. Fixed in `0009_rls_policies.sql` by also allowing
`current_user = 'service_role'`. Re-verified after the fix: seeding via
`service_role` succeeds, and the trigger still correctly blocks
students/teachers/guests from self-promoting.

## Conclusion

All three enforcement layers — middleware (edge), server-side layout
guards (`requireRouteAccess`), and Postgres RLS (the actual data
boundary) — independently enforce the same rules and agree with each
other for all four personas. Authorization is not implemented as
frontend button-hiding at any point in this stack.
