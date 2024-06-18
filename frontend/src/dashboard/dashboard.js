'use strict';

const api = require('../api');
const template = require('./dashboard.html');

module.exports = app => app.component('dashboard', {
  template: template,
  data: function() {
    return {
      status: 'loading',
      code: '',
      name: '',
      editor: null,
      showEditor: false,
      dashboard: null
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
  mounted: async function() {
    const dashboardId = this.$route.query.dashboardId;
    const { dashboard } = await api.Dashboard.getDashboard({ params: { dashboardId: dashboardId } });
    if (!dashboard) {
      return;
    }
    this.dashboard = dashboard;
    this.name = this.dashboard.name;
    this.code = this.dashboard.code;
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
    this.status = 'loaded';
  }
});
