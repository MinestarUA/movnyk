// Snap a 0–100 progress value down to its 5% resting mark.
export function restBucket(progress) {
  const clamped = Math.max(0, Math.min(100, progress));
  return Math.floor(clamped / 5) * 5;
}

// Decide how the cat should move and which pose it wears, given the previous and
// next 5% rest buckets, whether progress is complete, and whether a row was just
// confirmed/unconfirmed. Crossing a bucket plays a walk stride; a row change that
// stays inside the same bucket bobs the cat in place; complete swaps to happy.
export function catStep(prevRest, nextRest, complete, countChanged) {
  const pose = complete ? "happy" : "walking";
  let move;
  if (nextRest > prevRest) move = "walk-forward";
  else if (nextRest < prevRest) move = "walk-backward";
  else if (countChanged && !complete) move = "hop";
  else move = "none";
  return { move, pose };
}
