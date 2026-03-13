'use strict';

/** Max number of paths to suggest by default. */
const DEFAULT_SUGGESTED_LIMIT = 6;

/** Required fields: highest priority. String gets full bonus only when required or has default. */
const SCORE_REQUIRED = 80;
const SCORE_STRING = 60;

/** Unique and indexed: next tier (good for display and lookup). */
const SCORE_UNIQUE = 45;
const SCORE_INDEXED = 35;

/** Penalties: arrays, mixed, and nested are poor default table columns. */
const PENALTY_ARRAY = 55;
const PENALTY_MIXED = 55;
const PENALTY_NESTED = 45;

/** Small bonuses for other scalar types (clear, compact in tables). */
const SCORE_NUMBER = 15;
const SCORE_DATE = 12;
const SCORE_BOOLEAN = 12;
const SCORE_OBJECT_ID = 10;

/** Fields referenced in the user's query/filter: include in projection. */
const SCORE_QUERY_FIELD = 70;

/** MongoDB operator prefix: keys starting with $ are not field names. */
const MONGO_OPERATOR_PREFIX = '$';

/** Tiebreaker: prefer earlier schema order. */
function schemaOrderTiebreaker(index, total) {
  return (total - index) / Math.max(total, 1);
}

/**
 * Recursively collect field paths from a MongoDB filter object.
 * Skips keys that are operators (start with $).
 * @param {object} obj - Filter or sub-filter
 * @param {string} [prefix] - Path prefix for nested keys
 * @returns {Set<string>} Set of field paths (e.g. 'name', 'address.city')
 */
function getFieldsFromFilter(obj, prefix = '') {
  const paths = new Set();
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    return paths;
  }
  for (const key of Object.keys(obj)) {
    if (key.startsWith(MONGO_OPERATOR_PREFIX)) {
      continue;
    }
    const path = prefix ? `${prefix}.${key}` : key;
    paths.add(path);
    const value = obj[key];
    if (value != null && typeof value === 'object' && !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype) {
      getFieldsFromFilter(value, path).forEach(p => paths.add(p));
    }
  }
  return paths;
}

/**
 * Get a suggested default projection (field list) for a Mongoose model using a simple scoring system.
 * Used when the user has not yet chosen which fields to show in the table view.
 *
 * Scoring (higher = earlier in list):
 * - required: most points. String gets full bonus only when required or has default
 * - fields in the query/filter: bonus so they appear in projection
 * - unique + indexed: next
 * - Arrays, Mixed, nested (Embedded): penalties (subtract points)
 * - Number, Date, Boolean, ObjectId: small positive
 * - schema order: tiebreaker
 *
 * @param {import('mongoose').Model} Model - Mongoose model
 * @param {{ limit?: number, filter?: object }} options - limit max paths returned; filter = parsed query to boost fields from
 * @returns {string[]} Ordered array of path names
 */
function getSuggestedProjection(Model, options = {}) {
  const limit = typeof options.limit === 'number' && options.limit > 0
    ? options.limit
    : DEFAULT_SUGGESTED_LIMIT;

  const pathNames = Object.keys(Model.schema.paths).filter(key => !key.includes('.$*'));
  if (pathNames.length === 0) {
    return [];
  }

  const pathSet = new Set(pathNames);
  const queryFields = options.filter != null && typeof options.filter === 'object'
    ? getFieldsFromFilter(options.filter)
    : new Set();
  const queryFieldPaths = new Set([...queryFields].filter(p => pathSet.has(p)));

  const indexFields = new Set();
  try {
    const indexes = Model.schema.indexes();
    for (const [fields] of indexes) {
      if (fields && typeof fields === 'object') {
        for (const key of Object.keys(fields)) {
          indexFields.add(key);
        }
      }
    }
  } catch (err) {
    // ignore
  }

  const scored = pathNames.map((path, index) => {
    const schemaType = Model.schema.paths[path];
    let score = 0;
    const opts = schemaType?.options ?? {};
    const instance = schemaType?.instance ?? (path === '_id' ? 'ObjectId' : 'other');

    if (opts.required) score += SCORE_REQUIRED;
    if (instance === 'String' && (opts.required || opts.default !== undefined)) score += SCORE_STRING;
    if (opts.unique) score += SCORE_UNIQUE;
    if (indexFields.has(path)) score += SCORE_INDEXED;
    if (queryFieldPaths.has(path)) score += SCORE_QUERY_FIELD;

    if (instance === 'Array') score -= PENALTY_ARRAY;
    else if (instance === 'Mixed') score -= PENALTY_MIXED;
    else if (schemaType?.schema) score -= PENALTY_NESTED;
    else if (instance === 'Number') score += SCORE_NUMBER;
    else if (instance === 'Date') score += SCORE_DATE;
    else if (instance === 'Boolean') score += SCORE_BOOLEAN;
    else if (instance === 'ObjectId' || path === '_id') score += SCORE_OBJECT_ID;

    score += schemaOrderTiebreaker(index, pathNames.length);

    return { path, score, instance };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  const typeOrder = ['String', 'Number', 'Date', 'Boolean', 'ObjectId', 'Array', 'Embedded', 'Mixed', 'other'];
  const byType = new Map();
  for (const item of top) {
    const raw = item.instance || 'other';
    const t = (raw === 'ObjectID' || raw === 'ObjectId') ? 'ObjectId' : raw;
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t).push(item);
  }
  for (const list of byType.values()) {
    list.sort((a, b) => b.score - a.score);
  }

  const result = [];
  for (const t of typeOrder) {
    const list = byType.get(t);
    if (list) result.push(...list.map(item => item.path));
  }
  return result;
}

module.exports = getSuggestedProjection;
