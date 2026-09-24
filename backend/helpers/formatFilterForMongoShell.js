'use strict';

const mongoose = require('mongoose');

const ObjectId = mongoose.Types.ObjectId;

function isPlainObject(value) {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value) || isObjectId(value) || value instanceof Date || value instanceof RegExp) {
    return false;
  }
  return true;
}

function isObjectId(value) {
  if (value instanceof ObjectId) {
    return true;
  }
  return value != null &&
    typeof value === 'object' &&
    value._bsontype === 'ObjectId' &&
    typeof value.toString === 'function';
}

function formatKey(key) {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return key;
  }
  return JSON.stringify(key);
}

function formatFilterForMongoShell(value) {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (isObjectId(value)) {
    return `ObjectId("${value.toString()}")`;
  }
  if (value instanceof Date) {
    return `ISODate("${value.toISOString()}")`;
  }
  if (value instanceof RegExp) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    const items = value.map(item => formatFilterForMongoShell(item));
    return `[${items.join(', ')}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(([key, val]) => {
      return `${formatKey(key)}: ${formatFilterForMongoShell(val)}`;
    });
    return `{ ${entries.join(', ')} }`;
  }

  throw new Error(`Unsupported filter value type: ${value?.constructor?.name || typeof value}`);
}

module.exports = formatFilterForMongoShell;
