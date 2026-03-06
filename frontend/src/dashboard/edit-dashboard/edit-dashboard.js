'use strict';

const api = require('../../api');
const template = require('./edit-dashboard.html');

module.exports = app => app.component('edit-dashboard', {
  template: template,
  props: ['dashboardId', 'code', 'currentDescription', 'currentTitle'],
  emits: ['close'],
  data: function() {
    return {
      status: 'loaded',
      title: '',
      description: '',
      editCode: ''
    };
  },
  mounted() {
    this.editCode = this.code || '';
    this.description = this.currentDescription;
    this.title = this.currentTitle;
  },
  methods: {
    closeEditor() {
      this.$emit('close');
    },
    async updateCode() {
      this.status = 'loading';
      try {
        const codeToSave = this.$refs.codeEditor ? this.$refs.codeEditor.getValue() : this.editCode;
        const { doc } = await api.Dashboard.updateDashboard({
          dashboardId: this.dashboardId,
          code: codeToSave,
          title: this.title,
          description: this.description,
          evaluate: false
        });
        this.$emit('update', { doc });
        this.editCode = doc.code;
        if (this.$refs.codeEditor) {
          this.$refs.codeEditor.setValue(doc.code);
        }
        this.$toast.success('Dashboard updated!');
        this.closeEditor();
      } catch (err) {
        this.$emit('update', { error: { message: err.message } });
      } finally {
        this.status = 'loaded';
      }
    }
  }
});
