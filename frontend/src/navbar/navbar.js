'use strict';

const template = require('./navbar.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./navbar.css'));

module.exports = app => app.component('navbar', {
  template: template,
  computed: {
    routeName() {
      return this.$route.name;
    }
  }
});