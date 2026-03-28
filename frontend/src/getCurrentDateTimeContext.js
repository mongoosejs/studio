'use strict';

const time = require('time-commando');

module.exports = function getCurrentDateTimeContext() {
  const date = time.now();
  const components = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ].map(num => num.toString().padStart(2, '0'));
  const [yyyy, mm, dd, hh, mi, ss] = components;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
};
