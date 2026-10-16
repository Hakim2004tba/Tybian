// Run with: node --experimental-strip-types tests/study-growth.test.ts

import {
  growthFromSeconds,
  cohortGarden,
  formatStudyTime,
  GROWTH_STAGES,
  MINUTES_PER_COHORT_TREE,
} from "../lib/study/growth.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) console.error(`FAIL: ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

const min = (m: number) => m * 60;

// --- stages -----------------------------------------------------------
check("no study at all is a seed", growthFromSeconds(0).stage.key, "seed");
check("29 minutes is still a seed", growthFromSeconds(min(29)).stage.key, "seed");
check("30 minutes reaches sprout", growthFromSeconds(min(30)).stage.key, "sprout");
check("120 minutes reaches sapling", growthFromSeconds(min(120)).stage.key, "sapling");
check("300 minutes reaches tree", growthFromSeconds(min(300)).stage.key, "tree");
check("600 minutes reaches blossom", growthFromSeconds(min(600)).stage.key, "blossom");
check("well past the top stays at blossom", growthFromSeconds(min(5000)).stage.key, "blossom");

check("stages are ordered by ascending threshold",
  GROWTH_STAGES.every((s, i) => i === 0 || s.minMinutes > GROWTH_STAGES[i - 1].minMinutes), true);

// --- distance to the next stage ---------------------------------------
check("a seed needs 30 more minutes", growthFromSeconds(0).minutesToNext, 30);
check("at 100 minutes, sapling is 20 away", growthFromSeconds(min(100)).minutesToNext, 20);
check("the final stage has no next", growthFromSeconds(min(700)).minutesToNext, null);
check("the final stage reports a full ring", growthFromSeconds(min(700)).fractionToNext, 1);
check("halfway through the sprout band", growthFromSeconds(min(75)).fractionToNext, 0.5);
check("fraction never exceeds 1", growthFromSeconds(min(9999)).fractionToNext <= 1, true);

// Negative/garbage input must not produce NaN widths in the DOM.
check("negative seconds clamp to zero minutes", growthFromSeconds(-500).minutes, 0);
check("negative seconds are a seed", growthFromSeconds(-500).stage.key, "seed");

// --- cohort garden ----------------------------------------------------
check("an idle cohort has no trees", cohortGarden([0, 0, 0]), {
  totalMinutes: 0, contributors: 0, trees: 0, fractionToNextTree: 0,
});

check("only students who studied count as contributors",
  cohortGarden([min(60), 0, min(30)]).contributors, 2);

check("600 shared minutes is exactly one tree",
  cohortGarden([min(MINUTES_PER_COHORT_TREE)]).trees, 1);

check("1500 shared minutes is two trees and half of a third",
  cohortGarden([min(900), min(600)]),
  { totalMinutes: 1500, contributors: 2, trees: 2, fractionToNextTree: 0.5 });

// --- formatting -------------------------------------------------------
check("under an hour shows minutes only", formatStudyTime(min(45)), "45د");
check("over an hour shows both", formatStudyTime(min(200)), "3س 20د");
check("zero is 0د, not empty", formatStudyTime(0), "0د");

console.log(`${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
