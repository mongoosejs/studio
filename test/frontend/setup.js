'use strict';

global.window = {};
global.window.MONGOOSE_STUDIO_CONFIG = {
  baseURL: 'http://localhost:9998'
};

// For frontend tests
const fs = require('fs');
const path = require('path');

require.extensions['.html'] = function(module, filename) {
  module.exports = fs.readFileSync(filename, 'utf8');
};

require.extensions['.css'] = function(module, filename) {
  module.exports = fs.readFileSync(filename, 'utf8');
};

global.appInstance = null;

module.exports = {
  getAppInstance() {
    return global.appInstance;
  },
  destroyed() {
    global.appInstance = null;
  },
  created() {
    global.appInstance = this;
  }
};
