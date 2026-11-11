// A short history of recent projects in localStorage, so a page reload or a
// switch to another file never wipes translation progress. Sessions hold only
// the editor rows: they carry each key's original text, so the source file is
// not needed to resume.

const STORAGE_KEY = "movnyk.sessions";
const LEGACY_STORAGE_KEY = "movnyk.autosave";
const LEGACY_SESSION_ID = "legacy";
const LEGACY_SESSION_NAME = "Попередня сесія";
const MAX_SESSIONS = 5;
// Lang files of unrelated mods share names (nearly every one is en_us.json),
// so a name match alone must not resume another project's progress.
const MIN_KEY_OVERLAP = 0.5;

export const newSessionId = () => crypto.randomUUID();

const isValidSession = (session) =>
  Boolean(session) &&
  typeof session.id === "string" &&
  typeof session.name === "string" &&
  Array.isArray(session.translations) &&
  session.translations.every((row) => typeof row?.key === "string") &&
  typeof session.savedAt === "number";

const isValidPack = (pack) =>
  Boolean(pack) &&
  typeof pack.namespace === "string" &&
  typeof pack.mcVersion === "string" &&
  typeof pack.language === "string";

// Export settings are optional extras: a malformed one is dropped so it can
// never cost the translation rows.
const normalize = ({ pack, ...session }) => (isValidPack(pack) ? { ...session, pack } : session);

const withoutDuplicateIds = (sessions) => {
  const seen = new Set();
  return sessions.filter(({ id }) => !seen.has(id) && seen.add(id));
};

const readSessions = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? withoutDuplicateIds(parsed.filter(isValidSession).map(normalize)) : [];
  } catch {
    return [];
  }
};

const writeSessions = (sessions) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch (error) {
    console.error("Could not persist sessions:", error);
    return false;
  }
};

const parseLegacySession = (raw) => {
  try {
    const legacy = JSON.parse(raw);
    const session = {
      id: LEGACY_SESSION_ID,
      name: LEGACY_SESSION_NAME,
      translations: legacy?.translations,
      savedAt: legacy?.savedAt,
    };
    return isValidSession(session) ? session : null;
  } catch {
    return null;
  }
};

// The old single-slot autosave joins the history. Its key is only dropped once
// its content is safe in the new store (or is unusable), so a failed write
// retries on the next load.
const mergeLegacyAutosave = (sessions) => {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw === null) return sessions;
    const legacy = parseLegacySession(raw);
    // An existing "legacy" session may have been edited since, so the old
    // payload must never overwrite it.
    if (!legacy || sessions.some(({ id }) => id === legacy.id)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return sessions;
    }
    const merged = [...sessions, legacy]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_SESSIONS);
    if (writeSessions(merged)) localStorage.removeItem(LEGACY_STORAGE_KEY);
    return merged;
  } catch {
    return sessions;
  }
};

// Most recently saved first.
export const loadSessions = () => mergeLegacyAutosave(readSessions());

// An unchanged file resumes its session; an edited version of it still does,
// as long as most of its keys are already in the saved rows.
export const findResumableSession = (sessions, name, content) => {
  const newKeys = Object.keys(content);
  if (newKeys.length === 0) return null;
  return (
    sessions.find((session) => {
      if (session.name !== name) return false;
      const savedKeys = new Set(session.translations.map((row) => row.key));
      const shared = newKeys.filter((key) => savedKeys.has(key)).length;
      return shared / newKeys.length >= MIN_KEY_OVERLAP;
    }) ?? null
  );
};

// When the browser's quota is exhausted, older sessions make room for the one
// being edited; the write only fails if that session alone does not fit.
export const saveSession = ({ id, name, translations, pack }) => {
  const saved = { id, name, translations, savedAt: Date.now(), ...(pack && { pack }) };
  const others = readSessions().filter((session) => session.id !== id);
  let sessions = [saved, ...others].slice(0, MAX_SESSIONS);
  while (!writeSessions(sessions)) {
    if (sessions.length === 1) return false;
    sessions = sessions.slice(0, -1);
  }
  return true;
};

export const deleteSession = (id) => {
  writeSessions(readSessions().filter((session) => session.id !== id));
};
