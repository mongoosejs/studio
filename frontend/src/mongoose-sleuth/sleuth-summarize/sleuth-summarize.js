'use strict';

const marked = require('marked').marked;
const template = require('./sleuth-summarize.html');

module.exports = app => app.component('sleuth-summarize', {
  template: template,
  inject: ['sleuthContext'],
  methods: {
    renderMarkdown(text) {
      if (!text) {
        return '';
      }
      return marked(text);
    }
  }
});
