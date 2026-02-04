'use strict';

const api = require('../../api');
const template = require('./execute-script.html');
const appendCSS = require('../../appendCSS');

appendCSS(require('./execute-script.css'));

module.exports = app => app.component('execute-script', {
  template,
  props: ['model', 'documentId', 'editting'],
  data() {
    return {
      scriptText: '',
      scriptResult: null,
      scriptLogs: '',
      scriptError: null,
      scriptHasRun: false,
      scriptRunning: false,
      scriptEditor: null
    };
  },
  mounted() {
    this.$nextTick(() => {
      this.initializeScriptEditor();
    });
  },
  beforeDestroy() {
    this.destroyScriptEditor();
  },
  methods: {
    close() {
      this.$emit('close');
    },
    initializeScriptEditor() {
      if (!this.$refs.scriptEditor || this.scriptEditor || typeof CodeMirror === 'undefined') {
        return;
      }

      this.$refs.scriptEditor.value = this.scriptText;
      this.scriptEditor = CodeMirror.fromTextArea(this.$refs.scriptEditor, {
        mode: 'javascript',
        lineNumbers: true,
        lineWrapping: true
      });
      this.scriptEditor.on('change', () => {
        this.scriptText = this.scriptEditor.getValue();
      });
    },
    destroyScriptEditor() {
      if (this.scriptEditor) {
        this.scriptEditor.toTextArea();
        this.scriptEditor = null;
      }
    },
    updateScriptText(event) {
      this.scriptText = event.target.value;
    },
    clearScript() {
      this.scriptText = '';
      this.scriptResult = null;
      this.scriptLogs = '';
      this.scriptError = null;
      this.scriptHasRun = false;
      if (this.scriptEditor) {
        this.scriptEditor.setValue('');
      }
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
      const scriptToRun = (this.scriptEditor ? this.scriptEditor.getValue() : this.scriptText || '').trim();
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
        if (this.scriptEditor) {
          this.scriptEditor.setValue(scriptToRun);
        }
        this.scriptResult = result;
        this.scriptLogs = logs;
        this.scriptHasRun = true;
        if (!this.editting) {
          this.$emit('refresh');
        }
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
