'use strict';

/**
 * Parse a raw projection input string into a Query.select()-compatible projection.
 *
 * Supports:
 * - `name email`
 * - `-password`
 * - `+email`
 * - `{ deletedAt: 1 }`
 * - `{ password: 0 }`
 *
 * @param {Object} options
 * @param {string|undefined} options.projectionInput
 * @param {string[]} options.schemaPaths
 * @returns {string|object|null}
 */
function parseProjectionParam({ projectionInput, schemaPaths }) {
  return parseProjectionInput(projectionInput, schemaPaths);
}

function parseProjectionInput(projectionInput, schemaPaths) {
  if (projectionInput == null || typeof projectionInput !== 'string') {
    return null;
  }
  const trimmed = projectionInput.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return parseProjectionObjectNotation(trimmed, schemaPaths);
  }

  const tokens = normalizeProjectionTokens(trimmed);
  if (tokens === null || tokens.length === 0) {
    return null;
  }

  const includeKeys = [];
  const excludeKeys = [];

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) {
      continue;
    }

    const prefix = token[0];
    if (prefix === '-') {
      const path = token.slice(1).trim();
      if (!path) {
        return null;
      }
      excludeKeys.push(path);
    } else if (prefix === '+') {
      const path = token.slice(1).trim();
      if (!path) {
        return null;
      }
      includeKeys.push(path);
    } else {
      includeKeys.push(token);
    }
  }

  const normalizeKey = key => String(key).trim();
  if (includeKeys.length > 0 && excludeKeys.length > 0) {
    const includeSet = new Set(includeKeys.map(normalizeKey));
    for (const path of excludeKeys) {
      const ex = normalizeKey(path);
      for (const key of Array.from(includeSet)) {
        if (key.toLowerCase() === ex.toLowerCase()) {
          includeSet.delete(key);
        }
      }
    }
    if (includeSet.size === 0) {
      return null;
    }
    return Array.from(includeSet).join(' ');
  }

  if (excludeKeys.length > 0) {
    return excludeKeys.map(path => `-${normalizeKey(path)}`).join(' ');
  }

  return includeKeys.map(normalizeKey).join(' ');
}

function normalizeProjectionTokens(trimmed) {
  const rawTokens = trimmed.split(/[,\s]+/).filter(Boolean);
  const tokens = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    if (token === '-' || token === '+') {
      if (i + 1 >= rawTokens.length) {
        return null;
      }
      tokens.push(token + rawTokens[++i]);
    } else {
      tokens.push(token);
    }
  }
  return tokens;
}

function parseProjectionObjectNotation(trimmed, schemaPaths) {
  const body = trimmed.slice(1, -1).trim();
  if (!body) {
    return null;
  }

  const pairRe = /(?:^|,)\s*(?:"([^"]+)"|'([^']+)'|([a-zA-Z_$][\w.$]*))\s*:\s*("[^"]*"|'[^']*'|[^,]+?)\s*(?=,|$)/g;
  const includeKeys = [];
  const excludeKeys = [];
  let matchedChars = '';
  let match;

  while ((match = pairRe.exec(body)) !== null) {
    matchedChars += match[0];
    const key = (match[1] || match[2] || match[3] || '').trim();
    const rawValue = (match[4] || '').trim();
    if (!key || !rawValue) {
      return null;
    }

    const valueLower = rawValue.replace(/^['"]|['"]$/g, '').trim().toLowerCase();
    const isInclude = valueLower === '1' || valueLower === 'true';
    const isExclude = valueLower === '0' || valueLower === 'false';
    if (!isInclude && !isExclude) {
      return null;
    }
    if (isInclude) {
      includeKeys.push(key);
    } else {
      excludeKeys.push(key);
    }
  }

  const normalizedBody = body.replace(/\s+/g, '');
  const normalizedMatched = matchedChars.replace(/\s+/g, '').replace(/^,/, '');
  if (!normalizedMatched || normalizedMatched !== normalizedBody) {
    return null;
  }

  const normalizeKey = key => String(key).trim();
  if (includeKeys.length > 0 && excludeKeys.length > 0) {
    const includeSet = new Set(includeKeys.map(normalizeKey));
    for (const path of excludeKeys) {
      const ex = normalizeKey(path);
      for (const key of Array.from(includeSet)) {
        if (key.toLowerCase() === ex.toLowerCase()) {
          includeSet.delete(key);
        }
      }
    }
    if (includeSet.size === 0) {
      return null;
    }
    return Array.from(includeSet).join(' ');
  }

  if (excludeKeys.length > 0) {
    const projection = {};
    for (const path of excludeKeys) {
      projection[normalizeKey(path)] = 0;
    }
    return Object.keys(projection).length > 0 ? projection : null;
  }

  const projection = {};
  for (const path of includeKeys) {
    projection[normalizeKey(path)] = 1;
  }
  return Object.keys(projection).length > 0 ? projection : null;
}

module.exports = parseProjectionParam;
