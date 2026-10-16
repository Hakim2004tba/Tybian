// Run with: node --experimental-strip-types tests/quiz-grade.test.ts

import { gradeQuestion, gradeAttempt } from "../lib/quiz/grade.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) console.error(`FAIL: ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

const q = (correct: string[], chosen: string[]) =>
  gradeQuestion({ questionId: "q1", correctOptionIds: correct, chosenOptionIds: chosen });

// --- all-or-nothing -----------------------------------------------------
check("exactly right is correct", q(["a", "c"], ["a", "c"]).isCorrect, true);
check("order does not matter", q(["a", "c"], ["c", "a"]).isCorrect, true);
check("a missed proposition fails the whole question", q(["a", "c"], ["a"]).isCorrect, false);
check("an extra wrong proposition fails it", q(["a"], ["a", "b"]).isCorrect, false);
check("answering nothing fails", q(["a"], []).isCorrect, false);
check("a blank answer to a blank key still fails", q([], []).isCorrect, false);

// --- the breakdown a student sees --------------------------------------
check("missed is reported", q(["a", "c"], ["a"]).missed, ["c"]);
check("wrong ticks are reported", q(["a"], ["a", "b"]).wrong, ["b"]);
check("hits are reported", q(["a", "c"], ["a", "b"]).hit, ["a"]);

// --- QCU behaves as a one-answer case of the same rule ------------------
check("QCU right", q(["b"], ["b"]).isCorrect, true);
check("QCU wrong", q(["b"], ["a"]).isCorrect, false);

// --- whole attempt ------------------------------------------------------
const attempt = gradeAttempt([
  { questionId: "1", correctOptionIds: ["a"], chosenOptionIds: ["a"] },
  { questionId: "2", correctOptionIds: ["a", "b"], chosenOptionIds: ["a"] },
  { questionId: "3", correctOptionIds: ["c"], chosenOptionIds: ["c"] },
]);
check("counts only fully-correct questions", attempt.correctCount, 2);
check("total is every question", attempt.total, 3);
check("score is a whole percent", attempt.scorePct, 67);

check("an empty quiz scores zero, not NaN", gradeAttempt([]).scorePct, 0);

console.log(`${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exitCode = 1;
