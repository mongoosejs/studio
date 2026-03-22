'use strict';

module.exports = function getCurrentDateTimeContext() {
  const now = new Date();
  const pad = val => String(val).padStart(2, '0');

  const date = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('-');
  const time = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join(':');

  return `${date}-${time}`;
};
