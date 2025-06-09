'use strict';

const appendCSS = require('../appendCSS');
const template = require('./modal.html');

appendCSS(require('./modal.css'));

module.exports = app => app.component('modal', {
  template,
  props: ['containerClass']
});
