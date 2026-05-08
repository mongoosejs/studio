'use strict';

const RECENT_PAGES_STORAGE_KEY = 'studio:recent-pages-history';
const RECENT_PAGES_CHANGED_EVENT = 'studio-recent-pages-changed';
const RECENT_PAGES_LOCK_NAME = `studio-lock:${RECENT_PAGES_STORAGE_KEY}`;
const MAX_RECENT_PAGES = 10;

/** Collapses hash-style prefixes (e.g. `/#/`) to a normal path; keeps query string. */
function normalizeTrackedPath(fullPath) {
  if (!fullPath || typeof fullPath !== 'string') {
    return '/';
  }
  const qIndex = fullPath.indexOf('?');
  const rawMain = qIndex === -1 ? fullPath : fullPath.slice(0, qIndex);
  const qs = qIndex === -1 ? '' : fullPath.slice(qIndex);

  let pathOnly = rawMain.trim().replace(/#/g, '');
  pathOnly = pathOnly.replace(/^\/+/u, '/');
  if (pathOnly !== '/' && /\/$/u.test(pathOnly)) {
    pathOnly = pathOnly.replace(/\/+$/u, '');
  }
  if (pathOnly === '' || pathOnly === '/') {
    pathOnly = '/';
  } else if (!pathOnly.startsWith('/')) {
    pathOnly = `/${pathOnly}`;
  }

  const out = qs ? pathOnly + qs : pathOnly;
  return out;
}

function safeReadRecentPages() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RECENT_PAGES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(entry => {
        if (!entry || typeof entry.path !== 'string') {
          return null;
        }
        return { ...entry, path: normalizeTrackedPath(entry.path) };
      })
      .filter(
        entry =>
          entry &&
          typeof entry.label === 'string' &&
          typeof entry.visitedAt === 'number' &&
          entry.path !== ''
      )
      .slice(0, MAX_RECENT_PAGES);
  } catch {
    return [];
  }
}

function notifyRecentPagesChangedFromThisTab() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(RECENT_PAGES_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

function saveRecentPages(entries) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(
    RECENT_PAGES_STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_RECENT_PAGES))
  );
  notifyRecentPagesChangedFromThisTab();
}

function withRecentPagesStorageLock(syncFn) {
  if (typeof window === 'undefined' || !window.localStorage) {
    syncFn();
    return Promise.resolve();
  }

  try {
    const locksApi =
      typeof navigator !== 'undefined' && navigator.locks !== undefined ? navigator.locks : null;

    if (locksApi !== null && typeof locksApi.request === 'function') {
      return locksApi.request(RECENT_PAGES_LOCK_NAME, syncFn);
    }
  } catch {
    /* fall through */
  }

  syncFn();
  return Promise.resolve();
}

module.exports = {
  RECENT_PAGES_STORAGE_KEY,
  RECENT_PAGES_CHANGED_EVENT,
  MAX_RECENT_PAGES,
  normalizeTrackedPath,
  safeReadRecentPages,
  saveRecentPages,
  withRecentPagesStorageLock
};
