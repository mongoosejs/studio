'use strict';

const DATE_FILTERS = [
  { value: 'last_hour', label: 'Last Hour' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' }
];

const DATE_FILTER_VALUES = DATE_FILTERS.map(f => f.value);

/**
 * Returns { start, end } Date objects for a given range key (e.g. 'last_hour', 'today').
 * Month ranges use UTC boundaries.
 * @param {string} selectedRange - One of DATE_FILTER_VALUES
 * @returns {{ start: Date, end: Date }}
 */
function getDateRangeForRange(selectedRange) {
  const now = new Date();
  let start, end;
  switch (selectedRange) {
    case 'last_hour':
      start = new Date();
      start.setHours(start.getHours() - 1);
      end = new Date();
      break;
    case 'today':
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisWeek':
      start = new Date(now.getTime() - (7 * 86400000));
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    case 'lastWeek':
      start = new Date(now.getTime() - (14 * 86400000));
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getTime() - (7 * 86400000));
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisMonth': {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
      break;
    }
    case 'lastMonth': {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      break;
    }
    default:
      start = new Date();
      start.setHours(start.getHours() - 1);
      end = new Date();
      break;
  }
  return { start, end };
}

module.exports = {
  DATE_FILTERS,
  DATE_FILTER_VALUES,
  getDateRangeForRange
};
