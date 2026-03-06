'use strict';

const api = require('../../api');
const template = require('./edit-dashboard.html');
const { createAceEditor, destroyAceEditor } = require('../../aceEditor');

module.exports = app => app.component('edit-dashboard', {
  template: template,
  props: ['dashboardId', 'code', 'currentDescription', 'currentTitle'],
  emits: ['close'],
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
      this.status = 'loading';
      try {
        const { doc } = await api.Dashboard.updateDashboard({
          dashboardId: this.dashboardId,
          code: this.editor.getValue(),
          title: this.title,
          description: this.description,
          evaluate: false
        });
        this.$emit('update', { doc });
        this.editor.setValue(doc.code);
        this.$toast.success('Dashboard updated!');
        this.closeEditor();
      } catch (err) {
        this.$emit('update', { error: { message: err.message } });
      } finally {
        this.status = 'loaded';
      }
    }
  },
  mounted: async function() {
    const container = this.$refs.codeEditor;
    this.editor = createAceEditor(container, {
      value: this.code || '',
      mode: 'javascript',
      lineNumbers: true,
      wrap: true
    });
    this.description = this.currentDescription;
    this.title = this.currentTitle;
  },
  beforeDestroy() {
    if (this.editor) {
      destroyAceEditor(this.editor);
    }
  }
});
