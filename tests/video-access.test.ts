// Dependency-free unit test for lib/video/access.ts — the actual
// server-side security boundary for video playback authorization.
// Run with: node --experimental-strip-types tests/video-access.test.ts

import { decideVideoAccess, type VideoAccessFacts } from "../lib/video/access.ts";

let pass = 0;
let fail = 0;

function check(name: string, facts: VideoAccessFacts, expectAllowed: boolean, expectReason?: string) {
  const result = decideVideoAccess(facts);
  const ok =
    result.allowed === expectAllowed &&
    (expectAllowed || (result as { reason: string }).reason === expectReason);

  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(`[FAIL] ${name}`);
    console.log(`  facts: ${JSON.stringify(facts)}`);
    console.log(`  expected: allowed=${expectAllowed}${expectReason ? ` reason=${expectReason}` : ""}`);
    console.log(`  actual:   ${JSON.stringify(result)}`);
  }
}

const base: VideoAccessFacts = {
  authenticated: true,
  lessonExists: true,
  courseStatus: "published",
  isFreePreview: false,
  isActivelyEnrolled: false,
  isOwningTeacher: false,
  isAdmin: false,
};

// 1. Guest (unauthenticated) — denied regardless of anything else
check("guest, published, enrolled=irrelevant", { ...base, authenticated: false }, false, "unauthenticated");
check("guest, even on free preview", { ...base, authenticated: false, isFreePreview: true }, false, "unauthenticated");
check("guest, even if somehow admin flag set", { ...base, authenticated: false, isAdmin: true }, false, "unauthenticated");

// 2. Lesson doesn't exist — denied, never leaks course/enrollment state
check("authenticated, lesson missing", { ...base, lessonExists: false }, false, "not_found");
check("admin, lesson missing", { ...base, lessonExists: false, isAdmin: true }, false, "not_found");

// 3. Admin bypasses everything else once lesson exists
check("admin, draft course, not enrolled", { ...base, courseStatus: "draft", isAdmin: true }, true);
check("admin, archived course, not enrolled", { ...base, courseStatus: "archived", isAdmin: true }, true);

// 4. Owning teacher bypasses course status/enrollment
check("owning teacher, draft course", { ...base, courseStatus: "draft", isOwningTeacher: true }, true);
check("owning teacher, archived course", { ...base, courseStatus: "archived", isOwningTeacher: true }, true);

// 5. Non-owner, non-admin — course must be published
check("student, draft course, enrolled=false", { ...base, courseStatus: "draft" }, false, "course_unavailable");
check("student, archived course, enrolled=true", { ...base, courseStatus: "archived", isActivelyEnrolled: true }, false, "course_unavailable");
check("non-owning teacher, draft course of ANOTHER teacher", { ...base, courseStatus: "draft", isOwningTeacher: false }, false, "course_unavailable");

// 6. Free preview on a published course — no enrollment required
check("student, published, free preview, not enrolled", { ...base, isFreePreview: true }, true);

// 7. Non-free lesson on published course — requires active enrollment
check("student, published, not free, not enrolled", { ...base }, false, "not_enrolled");
check("student, published, not free, actively enrolled", { ...base, isActivelyEnrolled: true }, true);

// 8. Expired/revoked enrollment must already show up as isActivelyEnrolled=false
//    (that boolean is computed by has_active_enrollment() in the DB layer,
//    which already accounts for expiry — this just confirms the pure
//    function treats "not actively enrolled" as a hard denial)
check("student, published, not free, expired enrollment (=false)", { ...base, isActivelyEnrolled: false }, false, "not_enrolled");

// 9. Free preview should still work even if the student happens to also
//    be (separately) enrolled — enrollment isn't required to short-circuit it
check("student, published, free preview, ALSO enrolled", { ...base, isFreePreview: true, isActivelyEnrolled: true }, true);

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
