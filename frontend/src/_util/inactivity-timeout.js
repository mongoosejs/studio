'use strict';

const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_STORAGE_KEY = 'studio:last-activity-at';
const ACTIVITY_THROTTLE_MS = 1000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];

function isProductionEnv(nodeEnv) {
  return nodeEnv === 'prod' || nodeEnv === 'production';
}

function logout() {
  window.localStorage.setItem('_mongooseStudioAccessToken', '');
  window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  window.location.reload();
}

let inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS;

function hasTimedOut(lastActivityAt) {
  return lastActivityAt > 0 && Date.now() - lastActivityAt >= inactivityTimeoutMs;
}

let timeoutId = null;
let started = false;
let lastResetAt = 0;

function recordActivity() {
  window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
}

function resetTimeout() {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  recordActivity();
  timeoutId = setTimeout(logout, inactivityTimeoutMs);
}

function onActivity() {
  const now = Date.now();
  if (now - lastResetAt < ACTIVITY_THROTTLE_MS) {
    return;
  }
  lastResetAt = now;
  resetTimeout();
}

function onVisibilityChange() {
  if (document.visibilityState !== 'visible') {
    return;
  }
  const lastActivityAt = Number(window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
  if (hasTimedOut(lastActivityAt)) {
    logout();
  }
}

function stopInactivityTimeout() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  for (const event of ACTIVITY_EVENTS) {
    window.removeEventListener(event, onActivity, true);
  }
  document.removeEventListener('visibilitychange', onVisibilityChange);
  started = false;
  lastResetAt = 0;
  inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS;
}

function resolveInactivityTimeoutMs(timeoutMinutes) {
  if (timeoutMinutes != null && Number.isFinite(timeoutMinutes) && timeoutMinutes > 0) {
    return timeoutMinutes * 60 * 1000;
  }
  return DEFAULT_INACTIVITY_TIMEOUT_MS;
}

function startInactivityTimeout(nodeEnv, { freshLogin = false, timeoutMinutes } = {}) {
  if (!isProductionEnv(nodeEnv)) {
    return;
  }
  if (started) {
    return;
  }
  started = true;
  inactivityTimeoutMs = resolveInactivityTimeoutMs(timeoutMinutes);

  if (!freshLogin) {
    const lastActivityAt = Number(window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
    if (hasTimedOut(lastActivityAt)) {
      logout();
      return;
    }
  }

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, onActivity, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  resetTimeout();
}

module.exports = {
  startInactivityTimeout,
  stopInactivityTimeout,
  isProductionEnv
};
