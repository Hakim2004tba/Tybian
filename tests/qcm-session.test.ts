import assert from "node:assert/strict";
import { verdictFor, summarise, clock, type Graded } from "../lib/qcm/session.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
};

const a = (chosen: string[], correct: string[], seconds = 10): Graded => ({
  questionId: "q",
  chosen,
  correct,
  seconds,
});

check("one right letter on a single-answer question is right", () => {
  assert.equal(verdictFor(a(["B"], ["B"])), "right");
});

check("the wrong letter is wrong", () => {
  assert.equal(verdictFor(a(["A"], ["B"])), "wrong");
});

check("answering nothing is skipped, not wrong", () => {
  assert.equal(verdictFor(a([], ["B"])), "skipped");
});

check("all the right letters and no others is right", () => {
  assert.equal(verdictFor(a(["A", "C"], ["A", "C"])), "right");
  assert.equal(verdictFor(a(["C", "A"], ["A", "C"])), "right", "order must not matter");
});

check("some of the right letters and nothing wrong is partial", () => {
  assert.equal(verdictFor(a(["A"], ["A", "C"])), "partial");
});

check("a right letter plus a wrong one is wrong, not partial", () => {
  /* The exam would not give it; neither do we. */
  assert.equal(verdictFor(a(["A", "B"], ["A", "C"])), "wrong");
});

check("every extra letter beyond the correct set is wrong", () => {
  assert.equal(verdictFor(a(["A", "C", "D"], ["A", "C"])), "wrong");
});

check("the score is out of the WHOLE set, not out of what was answered", () => {
  /* Three answered, all right, out of ten. Not 100%. */
  const s = summarise([a(["A"], ["A"]), a(["A"], ["A"]), a(["A"], ["A"])], 10);
  assert.equal(s.right, 3);
  assert.equal(s.percent, 30);
  assert.equal(s.skipped, 7);
});

check("partial answers do not count toward the score", () => {
  const s = summarise([a(["A"], ["A", "C"]), a(["B"], ["B"])], 2);
  assert.equal(s.partial, 1);
  assert.equal(s.right, 1);
  assert.equal(s.percent, 50);
});

check("the counts always add up to what was answered", () => {
  const s = summarise(
    [a(["A"], ["A"]), a(["A"], ["B"]), a(["A"], ["A", "C"]), a([], ["A"])],
    6
  );
  assert.equal(s.right + s.partial + s.wrong, s.answered);
  assert.equal(s.answered + s.skipped, s.total);
});

check("an empty session is zero, not NaN", () => {
  const s = summarise([], 0);
  assert.equal(s.percent, 0);
  assert.equal(s.averageSeconds, 0);
  assert.equal(s.totalSeconds, 0);
});

check("average time is per ANSWERED question", () => {
  const s = summarise([a(["A"], ["A"], 30), a(["A"], ["B"], 10), a([], ["A"], 5)], 3);
  assert.equal(s.answered, 2);
  /* 45 seconds total across the session, 2 answered -> 23 (rounded). */
  assert.equal(s.totalSeconds, 45);
  assert.equal(s.averageSeconds, 23);
});

check("the clock keeps counting past an hour", () => {
  assert.equal(clock(0), "00:00");
  assert.equal(clock(65), "01:05");
  assert.equal(clock(3725), "62:05");
  assert.equal(clock(-5), "00:00");
});

console.log(`${passed} passed, 0 failed (${passed} total assertions)`);
