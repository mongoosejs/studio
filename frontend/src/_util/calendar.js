'use strict';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (Number.isNaN(n)) {
    return min;
  }
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DDTHH:mm:ss.SSS
 */
function dateToDatetimeLocal(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  return [
    date.getFullYear(),
    '-',
    pad2(date.getMonth() + 1),
    '-',
    pad2(date.getDate()),
    'T',
    pad2(date.getHours()),
    ':',
    pad2(date.getMinutes()),
    ':',
    pad2(date.getSeconds()),
    '.',
    pad3(date.getMilliseconds())
  ].join('');
}

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
function dateToDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  return [
    date.getFullYear(),
    '-',
    pad2(date.getMonth() + 1),
    '-',
    pad2(date.getDate())
  ].join('');
}

/**
 * @param {unknown} value
 * @returns {Date|null}
 */
function parseValueToDate(value) {
  if (value == null || value === '') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * @param {string} localValue - YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.SSS
 * @returns {Date|null}
 */
function localStringToDate(localValue) {
  if (!localValue) {
    return null;
  }
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function isSameDay(a, b) {
  if (!a || !b) {
    return false;
  }
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function isSameMonth(date, year, month) {
  return date.getFullYear() === year && date.getMonth() === month;
}

/**
 * Build a 6-row calendar grid for the given month (local timezone).
 * @param {number} year
 * @param {number} month - 0-indexed
 * @returns {Array<{ key: string, label: number, date: Date, inMonth: boolean }>}
 */
function buildCalendarDays(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    days.push({
      key: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
      label: date.getDate(),
      date,
      inMonth: date.getMonth() === month
    });
  }
  return days;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

module.exports = {
  pad2,
  pad3,
  clampInt,
  dateToDatetimeLocal,
  dateToDateOnly,
  parseValueToDate,
  localStringToDate,
  isSameDay,
  isSameMonth,
  buildCalendarDays,
  WEEKDAY_LABELS,
  MONTH_LABELS
};
