'use strict';

const api = require('../api');
const template = require('./charts.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./charts.css'));

module.exports = app => app.component('charts', {
  template: template,
  data: () => ({ description: '', code: '' }),
  methods: {
    async createChart() {
      const data = await api.Model.createChart({ description: this.description });
      this.code = data.content;
    }
  }
});