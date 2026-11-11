// Raw guidebook source files per session, kept in IndexedDB: they are too big
// for the localStorage sessions and are only needed to rewrite non-text fields
// on export. Every function resolves (never rejects); a failure is logged and
// reported as false/null, because losing these files must not break editing.

const DB_NAME = "movnyk";
const DB_VERSION = 1;
const STORE = "bookSources";

const openDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "sessionId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

// Runs `work(store)` in one transaction; resolves with the value `work` returns
// through its request, once the transaction has committed.
const inStore = async (mode, work) => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};

export const saveBookSources = async (sessionId, files) => {
  try {
    await inStore("readwrite", (store) => store.put({ sessionId, files, savedAt: Date.now() }));
    return true;
  } catch (error) {
    console.error("Could not save book sources:", error);
    return false;
  }
};

export const loadBookSources = async (sessionId) => {
  try {
    const record = await inStore("readonly", (store) => store.get(sessionId));
    return record?.files ?? null;
  } catch (error) {
    console.error("Could not load book sources:", error);
    return null;
  }
};

export const pruneBookSources = async (keepIds) => {
  try {
    const keep = new Set(keepIds);
    await inStore("readwrite", (store) => {
      const request = store.openKeyCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (!keep.has(cursor.key)) store.delete(cursor.key);
        cursor.continue();
      };
      return request;
    });
  } catch (error) {
    console.error("Could not prune book sources:", error);
  }
};
