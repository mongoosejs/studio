'use strict';

const api = require('../api');

const template = require('./create-dashboard.html');
const { createAceEditor, destroyAceEditor } = require('../aceEditor');

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
      this.$toast.success('Dashboard created!');
      this.$emit('close', dashboard);
    }
  },
  mounted: function() {
    const container = this.$refs.codeEditor;
    this._editor = createAceEditor(container, {
      value: this.code || '',
      mode: 'javascript',
      lineNumbers: true
    });
    this._editor.session.on('change', () => {
      this.code = this._editor.getValue();
    });
  },
  beforeDestroy() {
    if (this._editor) {
      destroyAceEditor(this._editor);
    }
  }
});