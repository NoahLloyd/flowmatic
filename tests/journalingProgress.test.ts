import assert from "assert";
import {
  advanceJournalingProgress,
  getJournalingProgress,
  hasCompletedJournaling,
  JOURNALING_TARGET_SECONDS,
  mergeJournalingProgress,
  normalizeWritingSeconds,
} from "../src/utils/journalingProgress";

assert.strictEqual(normalizeWritingSeconds(undefined), 0);
assert.strictEqual(normalizeWritingSeconds(-10), 0);
assert.strictEqual(normalizeWritingSeconds(42.9), 42);
assert.strictEqual(normalizeWritingSeconds(10_000), JOURNALING_TARGET_SECONDS);

const almostDone = advanceJournalingProgress(
  { seconds: JOURNALING_TARGET_SECONDS - 2 },
  1,
  "2026-08-04T07:00:00.000Z"
);
assert.deepStrictEqual(almostDone, { seconds: JOURNALING_TARGET_SECONDS - 1 });
assert.strictEqual(hasCompletedJournaling({ writingSeconds: almostDone.seconds }), false);

const completed = advanceJournalingProgress(
  almostDone,
  5,
  "2026-08-04T07:00:01.000Z"
);
assert.deepStrictEqual(completed, {
  seconds: JOURNALING_TARGET_SECONDS,
  completedAt: "2026-08-04T07:00:01.000Z",
});
assert.strictEqual(hasCompletedJournaling({
  writingSeconds: completed.seconds,
  journalingCompletedAt: completed.completedAt,
}), true);

const resetSafe = mergeJournalingProgress(
  completed,
  { seconds: 0 },
  { seconds: 120 }
);
assert.deepStrictEqual(resetSafe, completed);

assert.deepStrictEqual(
  getJournalingProgress({
    writingSeconds: 0,
    journalingCompletedAt: "2026-08-04T07:00:01.000Z",
  }),
  completed
);

console.log("journalingProgress tests passed");
