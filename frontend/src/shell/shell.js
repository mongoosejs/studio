'use strict';

const api = require('../api');
const template = require('./shell.html');

module.exports = app => app.component('shell', {
  template,
  data: () => ({
    history: [],
    code: '',
    result: ''
  }),
  mounted() {
    this._editor = CodeMirror.fromTextArea(this.$refs.codeEditor, {
      mode: 'javascript',
      lineNumbers: true
    });
    this._editor.setSize('calc(100vw - 12rem - 1px)', '100%');
  },
  methods: {
    async execute() {
      const code = this._editor.getValue();
      this.code = code;
      const { asString } = await api.Script.execute({ code });
      this.result = asString;
    }
  }
});
