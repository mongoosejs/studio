'use strict';

/**
 * Parse the `fields` request param for Model.getDocuments / getDocumentsStream.
 * Expects JSON: either `["a","b"]` (inclusion list) or `{"a":1,"b":1}` (Mongo projection).
 *
 * @param {string|undefined} fields
 * @returns {string|object|null} Argument suitable for Query.select(), or null when unset/invalid.
 */
function parseFieldsParam(fields) {
  if (fields == null || typeof fields !== 'string') {
    return null;
  }
  const trimmed = fields.trim();
  if (!trimmed) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return null;
  }

  if (Array.isArray(parsed)) {
    const list = parsed.map(x => String(x).trim()).filter(Boolean);
    return list.length > 0 ? list.join(' ') : null;
  }
  if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return Object.keys(parsed).length > 0 ? parsed : null;
  }
  return null;
}

module.exports = parseFieldsParam;
