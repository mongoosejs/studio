'use strict';

const { inspect } = require('node-inspect-extracted');

/**
 * Format a value for display in array views
 * @param {*} item - The item to format
 * @returns {string} - Formatted string representation
 */
function formatValue(item) {
  if (item == null) {
    return 'null';
  }
  if (typeof item === 'object') {
    return inspect(item, { maxArrayLength: 50 });
  }
  return String(item);
}

/**
 * Check if an item is a plain object (not array, not null)
 * @param {*} item - The item to check
 * @returns {boolean} - True if item is a plain object
 */
function isObjectItem(item) {
  return item != null && typeof item === 'object' && !Array.isArray(item) && item.constructor === Object;
}

/**
 * Get the keys of an object item
 * @param {*} item - The item to get keys from
 * @returns {string[]} - Array of keys, or empty array if not an object
 */
function getItemKeys(item) {
  if (!isObjectItem(item)) {
    return [];
  }
  return Object.keys(item);
}

/**
 * Format a specific value from an object item by key
 * @param {*} item - The object item
 * @param {string} key - The key to get the value for
 * @returns {string} - Formatted string representation of the value
 */
function formatItemValue(item, key) {
  const value = item[key];
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'object') {
    return inspect(value, { maxArrayLength: 50 });
  }
  return String(value);
}

/**
 * True when every element is a plain object (empty array counts as eligible).
 */
function isArrayOfObjects(arr) {
  return Array.isArray(arr) && arr.every(item => isObjectItem(item));
}

/**
 * Sorted union of keys across plain object elements.
 */
function unionKeysForArrayOfObjects(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }
  const set = new Set();
  for (const item of arr) {
    if (!isObjectItem(item)) {
      continue;
    }
    for (const k of Object.keys(item)) {
      set.add(k);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Flat text for substring search over one array element (field names + values, or whole item).
 * @param {*} item
 * @returns {string}
 */
function searchTextForArrayItem(item) {
  if (item == null) {
    return String(item);
  }
  if (isObjectItem(item)) {
    return getItemKeys(item)
      .map(k => `${k} ${formatItemValue(item, k)}`)
      .join(' \n ');
  }
  return formatValue(item);
}

/**
 * Case-insensitive substring match against an array element.
 * @param {*} item
 * @param {string} normalizedQuery lowercased trimmed query; empty matches all
 */
function arrayItemMatchesSearch(item, normalizedQuery) {
  if (normalizedQuery == null || normalizedQuery === '') {
    return true;
  }
  return searchTextForArrayItem(item).toLowerCase().includes(normalizedQuery);
}

module.exports = {
  formatValue,
  isObjectItem,
  getItemKeys,
  formatItemValue,
  isArrayOfObjects,
  unionKeysForArrayOfObjects,
  searchTextForArrayItem,
  arrayItemMatchesSearch
};
