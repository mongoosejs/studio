'use strict';

const api = require('../../api');
const template = require('./execute-script.html');
const appendCSS = require('../../appendCSS');

appendCSS(require('./execute-script.css'));

module.exports = app => app.component('execute-script', {
  template,
  props: ['model', 'documentId', 'editting', 'visible'],
  data() {
    return {
      scriptText: '',
      scriptResult: null,
      scriptLogs: '',
      scriptError: null,
      scriptHasRun: false,
      scriptRunning: false,
      isOpen: false,
      isClosing: false
    };
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.isOpen = true;
        this.isClosing = false;
      } else if (this.isOpen) {
        this.isClosing = true;
        setTimeout(() => {
          this.isOpen = false;
          this.isClosing = false;
        }, 200);
      }
    }
  },
  mounted() {
    if (this.visible) {
      this.isOpen = true;
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    clearScript() {
      this.scriptText = '';
      this.scriptResult = null;
      this.scriptLogs = '';
      this.scriptError = null;
      this.scriptHasRun = false;
    },
    formatScriptOutput(value) {
      if (value === undefined) {
        return 'undefined';
      }
      if (value === null) {
        return 'null';
      }
      if (typeof value === 'string') {
        return value;
      }
      try {
        return JSON.stringify(value, null, 2);
      } catch (err) {
        return String(value);
      }
    },
    async runDocumentScript() {
      const scriptToRun = (this.scriptText || '').trim();
      if (!scriptToRun) {
        this.$toast.error('Script cannot be empty.');
        return;
      }

      this.scriptRunning = true;
      this.scriptError = null;
      this.scriptHasRun = false;
      try {
        const { result, logs } = await api.Model.executeDocumentScript({
          model: this.model,
          documentId: this.documentId,
          script: scriptToRun
        });
        this.scriptText = scriptToRun;
        this.scriptResult = result;
        this.scriptLogs = logs;
        this.scriptHasRun = true;
        this.$emit('refresh');
        this.$toast.success('Script executed successfully!');
      } catch (err) {
        this.scriptError = err?.message || String(err);
        this.$toast.error('Script execution failed.');
      } finally {
        this.scriptRunning = false;
      }
    }
  }
});
