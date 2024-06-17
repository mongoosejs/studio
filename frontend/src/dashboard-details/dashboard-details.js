'use strict';

const api = require('../api');
const template = require('./dashboard-details.html');

module.exports = app => app.component('dashboard-details', {
  template: template,
  props: ['dashboard'],
  data: function() {
    return {
      code: '',
      editor: null,
      showEditor: false,
    }
  },
  methods: {
    toggleEditor() {
      this.showEditor = !this.showEditor;
    },
    async updateCode() {
      const { doc } = await api.Dashboard.updateDashboard({ dashboardId: this.dashboard._id, code: this.editor.getValue() });
      this.code = doc.code;
      this.showEditor = false;
    }
  },
  mounted: function() {
    this.$refs.codeEditor.value = this.dashboard.code;
    this.editor = CodeMirror.fromTextArea(this.$refs.codeEditor, {
      mode: 'javascript',
      lineNumbers: true,
      indentUnit: 4,
      smartIndent: true,
      tabsize: 4,
      indentWithTabs: true
    });
    this.editor.refresh(); // if anything weird happens on load, this usually fixes it.
  }
});
