import { useCallback, useEffect, useRef, useState } from "react";
import { pickRowToSteal } from "./rewards";

export const GOOSE_MIN_LEVEL = 3;
const MIN_DELAY_MS = 3 * 60 * 1000;
const MAX_DELAY_MS = 7 * 60 * 1000;
export const GOOSE_RETURN_MS = 90 * 1000;

const randomDelay = () => MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

// Occasionally a goose hides one untranslated row from the list. The row stays in the
// data (progress and export are unaffected) and comes back on its own after a while.
export const useGooseEvent = ({ translations, selectedKey, active }) => {
  const [stolenKey, setStolenKey] = useState(null);
  const latest = useRef({ translations, selectedKey });

  useEffect(() => {
    latest.current = { translations, selectedKey };
  }, [translations, selectedKey]);

  useEffect(() => {
    if (!active || stolenKey) return undefined;
    let timerId;
    const schedule = () => {
      timerId = setTimeout(() => {
        const key = pickRowToSteal(latest.current.translations, latest.current.selectedKey);
        if (key) setStolenKey(key);
        else schedule();
      }, randomDelay());
    };
    schedule();
    return () => clearTimeout(timerId);
  }, [active, stolenKey]);

  useEffect(() => {
    if (!stolenKey) return undefined;
    const timerId = setTimeout(() => setStolenKey(null), GOOSE_RETURN_MS);
    return () => clearTimeout(timerId);
  }, [stolenKey]);

  const returnRow = useCallback(() => setStolenKey(null), []);

  return { stolenKey: active ? stolenKey : null, returnRow };
};
