'use strict';

/**
 * Deep equality check for values (handles primitives, arrays, objects, dates, etc.)
 * @param {*} a - First value to compare
 * @param {*} b - Second value to compare
 * @returns {boolean} - True if values are deeply equal
 */
function deepEqual(a, b) {
  // Handle primitives and same reference
  if (a === b) return true;
  
  // Handle null and undefined
  if (a == null || b == null) return a === b;
  
  // Handle different types
  if (typeof a !== typeof b) return false;
  
  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  // Handle arrays - must both be arrays
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  // Handle objects (non-arrays)
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }
  
  // Fallback for primitives (strings, numbers, booleans)
  return false;
}

module.exports = deepEqual;
