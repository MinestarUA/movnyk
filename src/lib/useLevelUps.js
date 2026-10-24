import { useCallback, useState } from "react";

// Tracks the highest level reached so un-confirming and re-confirming a row never
// re-triggers a celebration, and perks never vanish after an accidental undo.
// Levels reached while rewards are off are absorbed silently.
export const useLevelUps = (level, enabled) => {
  const [state, setState] = useState({ reached: level, queue: [] });

  if (level > state.reached) {
    const newLevels = enabled
      ? Array.from({ length: level - state.reached }, (_, i) => state.reached + 1 + i)
      : [];
    setState({ reached: level, queue: [...state.queue, ...newLevels] });
  }

  const dismiss = useCallback(() => setState((s) => ({ ...s, queue: s.queue.slice(1) })), []);
  const dismissAll = useCallback(() => setState((s) => ({ ...s, queue: [] })), []);

  return {
    unlockedLevel: Math.max(level, state.reached),
    celebratingLevel: enabled ? (state.queue[0] ?? null) : null,
    queuedCount: state.queue.length,
    dismiss,
    dismissAll,
  };
};
