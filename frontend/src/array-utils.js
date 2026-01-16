'use strict';

const { inspect } = require('node-inspect-extracted');
const deepEqual = require('./_util/deepEqual');

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

module.exports = {
  formatValue,
  isObjectItem,
  getItemKeys,
  formatItemValue,
  deepEqual
};
