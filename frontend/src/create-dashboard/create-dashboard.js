'use strict';

const api = require('../api');
const vanillatoasts = require('vanillatoasts');

const template = require('./create-dashboard.html');

module.exports = app => app.component('create-dashboard', {
  template,
  data: function() {
    return {
      title: '',
      code: '',
      errors: []
    };
  },
  methods: {
    async createDashboard() {
      this.code = this._editor.getValue();
      const { dashboard } = await api.Dashboard.createDashboard({ code: this.code, title: this.title }).catch(err => {
        if (err.response?.data?.message) {
          console.log(err.response.data);
          const message = err.response.data.message.split(': ').slice(1).join(': ');
          this.errors = message.split(',').map(error => {
            return error.split(': ').slice(1).join(': ').trim();
          });
          throw new Error(err.response?.data?.message);
        }
        throw err;
      });
      this.errors.length = 0;
      vanillatoasts.create({
        title: 'Dashboard created!',
        type: 'success',
        timeout: 3000,
        icon: 'images/success.png',
        positionClass: 'bottomRight'
      });
      this.$emit('close', dashboard);
    }
  },
  mounted: function() {
    this._editor = CodeMirror.fromTextArea(this.$refs.codeEditor, {
      mode: 'javascript',
      lineNumbers: true
    });
  }
});