// A short history of recent projects in localStorage, so a page reload or a
// switch to another file never wipes translation progress.

const STORAGE_KEY = "movnyk.sessions";
const LEGACY_STORAGE_KEY = "movnyk.autosave";
const MAX_SESSIONS = 5;
const LEGACY_SESSION_NAME = "Попередня сесія";

export const newSessionId = () => crypto.randomUUID();

// Reopening the same file must land in the same slot instead of adding a copy.
export const sessionIdForName = (name) => `name:${name}`;

const isValidSession = (session) =>
  Boolean(session) &&
  typeof session.id === "string" &&
  typeof session.name === "string" &&
  typeof session.template === "object" &&
  session.template !== null &&
  Array.isArray(session.translations) &&
  session.translations.every((row) => typeof row === "object" && row !== null) &&
  typeof session.savedAt === "number";

const readSessions = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed.filter(isValidSession) : [];
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

// The old single-slot autosave becomes the first history entry. The old key is
// only dropped once its content is safe in the new store (or is unusable).
const migrateLegacyAutosave = () => {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const legacy = JSON.parse(raw);
    const session = {
      id: newSessionId(),
      name: LEGACY_SESSION_NAME,
      template: legacy?.template,
      translations: legacy?.translations,
      savedAt: legacy?.savedAt,
    };
    const sessions = isValidSession(session) ? [session] : [];
    if (sessions.length === 0 || writeSessions(sessions)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return sessions;
  } catch {
    return [];
  }
};

// Most recently saved first.
export const loadSessions = () => {
  const sessions = readSessions();
  return sessions.length > 0 ? sessions : migrateLegacyAutosave();
};

export const saveSession = ({ id, name, template, translations }) => {
  const others = readSessions().filter((session) => session.id !== id);
  const saved = { id, name, template, translations, savedAt: Date.now() };
  return writeSessions([saved, ...others].slice(0, MAX_SESSIONS));
};

export const deleteSession = (id) => {
  writeSessions(readSessions().filter((session) => session.id !== id));
};
