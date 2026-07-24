// Snap a 0–100 progress value down to its 5% resting mark.
export function restBucket(progress) {
  const clamped = Math.max(0, Math.min(100, progress));
  return Math.floor(clamped / 5) * 5;
}

// Decide how the cat should move and which pose it wears, given the previous
// and next 5% rest buckets plus the raw progress (for the 100% happy state).
export function catStep(prevRest, nextRest, progress) {
  const pose = progress >= 100 ? "happy" : "walking";
  let move;
  if (nextRest > prevRest) move = "walk-forward";
  else if (nextRest < prevRest) move = "walk-backward";
  else if (progress > prevRest && progress < 100) move = "hop";
  else move = "none";
  return { move, pose };
}
