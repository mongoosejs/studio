'use strict';

let debuggingEnabled = false;

exports.enableDebugging = function enableDebugging() {
  debuggingEnabled = true;
};

exports.isDebuggingEnabled = function isDebuggingEnabled() {
  return debuggingEnabled;
};
