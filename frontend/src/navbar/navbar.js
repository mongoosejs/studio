'use strict';

const template = require('./navbar.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./navbar.css'));

module.exports = app => app.component('navbar', {
  template: template,
  computed: {
    documents() {
      return this.$route.name == 'root';
    },
    dashboards() {
      return this.$route.name == 'dashboards';
    }
  }
});