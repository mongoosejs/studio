'use strict';

const marked = require('marked').marked;
const template = require('./sleuth-unified.html');

module.exports = app => app.component('sleuth-unified', {
  template,
  inject: ['sleuthContext'],
  methods: {
    renderMarkdown(text) {
      if (!text) return '';
      return marked(text);
    }
  }
});
