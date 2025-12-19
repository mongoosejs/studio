'use strict';

const template = require('./mongoose-loading.html');
const appendCSS = require('../appendCSS');

appendCSS(require('./mongoose.loading.css'));

module.exports = app => app.component('mongoose-loading', {
  template
});
