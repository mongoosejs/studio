'use strict';

exports.isoToLongDateTime = function isoToLongDateTime(str) {
  if (!str) {
    return 'Unknown';
  }
  const date = new Date(str);
  return date.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: 'numeric' });
};
