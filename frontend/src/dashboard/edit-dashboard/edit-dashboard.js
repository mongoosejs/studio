'use strict';

const api = require('../../api');
const template = require('./edit-dashboard.html');

module.exports = app => app.component('edit-dashboard', {
  template: template,
  props: ['dashboardId', 'code', 'currentDescription', 'currentTitle'],
  emits: ['close', 'clearError'],
  data: function() {
    return {
      status: 'loaded',
      editor: null,
      title: '',
      description: ''
    };
  },
  methods: {
    closeEditor() {
      this.$emit('close');
    },
    async updateCode() {
      this.$emit('clearError');
      this.status = 'loading';
      try {
        const { doc, result, error } = await api.Dashboard.updateDashboard({
          dashboardId: this.dashboardId,
          code: this.editor.getValue(),
          title: this.title,
          description: this.description
        });
        this.$emit('update', { doc, result, error });
        this.editor.setValue(doc.code);
        this.closeEditor();
      } catch (err) {
        this.$emit('update', { error: { message: err.message } });
      } finally {
        this.status = 'loaded';
      }
    }
  },
  mounted: async function() {
    this.editor = CodeMirror.fromTextArea(this.$refs.codeEditor, {
      mode: 'javascript',
      lineNumbers: true,
      indentUnit: 4,
      smartIndent: true,
      tabsize: 4,
      indentWithTabs: true,
      cursorBlinkRate: 300,
      lineWrapping: true,
      showCursorWhenSelecting: true
    });
    // this.editor.focus();
    // this.editor.refresh(); // if anything weird happens on load, this usually fixes it. However, this breaks it in this case.
    this.description = this.currentDescription;
    this.title = this.currentTitle;
  }
});
