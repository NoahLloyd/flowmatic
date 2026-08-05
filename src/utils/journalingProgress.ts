export const JOURNALING_TARGET_SECONDS = 15 * 60;

export interface JournalingProgress {
  seconds: number;
  completedAt?: string;
}

interface JournalingActivityContent {
  writingSeconds?: unknown;
  journalingCompletedAt?: unknown;
}

export const normalizeWritingSeconds = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(JOURNALING_TARGET_SECONDS, Math.max(0, Math.floor(value)));
};

export const getJournalingProgress = (
  activityContent: JournalingActivityContent | null | undefined
): JournalingProgress => {
  const seconds = normalizeWritingSeconds(activityContent?.writingSeconds);
  const completedAt =
    typeof activityContent?.journalingCompletedAt === "string" &&
    activityContent.journalingCompletedAt.length > 0
      ? activityContent.journalingCompletedAt
      : undefined;

  return {
    seconds: completedAt ? JOURNALING_TARGET_SECONDS : seconds,
    completedAt,
  };
};

/** Merge progress monotonically so an old save or a timer reset cannot undo it. */
export const mergeJournalingProgress = (
  ...progressValues: Array<Partial<JournalingProgress> | null | undefined>
): JournalingProgress => {
  let seconds = 0;
  let completedAt: string | undefined;

  for (const progress of progressValues) {
    if (!progress) continue;
    seconds = Math.max(seconds, normalizeWritingSeconds(progress.seconds));
    if (!completedAt && typeof progress.completedAt === "string") {
      completedAt = progress.completedAt;
    }
  }

  if (completedAt || seconds >= JOURNALING_TARGET_SECONDS) {
    return {
      seconds: JOURNALING_TARGET_SECONDS,
      completedAt,
    };
  }

  return { seconds };
};

export const advanceJournalingProgress = (
  progress: JournalingProgress,
  elapsedSeconds: number,
  completedAt: string
): JournalingProgress => {
  const nextSeconds = normalizeWritingSeconds(
    progress.seconds + Math.max(0, Math.floor(elapsedSeconds))
  );

  if (nextSeconds >= JOURNALING_TARGET_SECONDS) {
    return {
      seconds: JOURNALING_TARGET_SECONDS,
      completedAt: progress.completedAt || completedAt,
    };
  }

  return progress.completedAt
    ? { seconds: nextSeconds, completedAt: progress.completedAt }
    : { seconds: nextSeconds };
};

export const hasCompletedJournaling = (
  activityContent: JournalingActivityContent | null | undefined
): boolean => {
  const progress = getJournalingProgress(activityContent);
  return (
    Boolean(progress.completedAt) ||
    progress.seconds >= JOURNALING_TARGET_SECONDS
  );
};
