'use strict';

const nodeEnv = process.env.NODE_ENV;
const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 15;

function parseInactivityTimeoutMinutes() {
  const raw = process.env.INACTIVITY_TIMEOUT_MINUTES;
  if (raw == null || raw === '') {
    return DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
  }
  return parsed;
}

const inactivityTimeoutMinutes = parseInactivityTimeoutMinutes();

module.exports = () => async function status() {
  return { nodeEnv, inactivityTimeoutMinutes };
};
