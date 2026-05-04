'use strict';

const marked = require('marked').marked;
const appendCSS = require('../../appendCSS');
const template = require('./sleuth-unified.html');

appendCSS(require('./sleuth-unified.css'));

module.exports = app => app.component('sleuth-unified', {
  template,
  inject: ['sleuthContext'],
  methods: {
    renderMarkdown(text) {
      if (!text) return '';
      return marked(text);
    },
    hasAiSummary() {
      const s = this.sleuthContext && this.sleuthContext.aiSummary;
      return typeof s === 'string' && s.trim().length > 0;
    }
  }
});
