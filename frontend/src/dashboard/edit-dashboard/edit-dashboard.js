'use strict';

const api = require('../../api');
const template = require('./edit-dashboard.html');

module.exports = app => app.component('edit-dashboard', {
  template: template,
  props: ['dashboardId', 'code', 'currentDescription', 'currentTitle'],
  data: function() {
    return {
      status: 'loading',
      editor: null,
      title: '',
      description: ''
    }
  },
  methods: {
    closeEditor() {
        this.$emit('close')
    },
    async updateCode() {
      console.log('this.title', this.title, 'this.description', this.description)
      const { doc, result, error } = await api.Dashboard.updateDashboard({
        dashboardId: this.dashboardId,
        code: this.editor.getValue(),
        title: this.title,
        description: this.description
      });
      this.$emit('update', { doc, result, error });
      this.editor.setValue(doc.code);
      this.closeEditor();
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
      showCursorWhenSelecting: true,
    });
    // this.editor.setValue(this.code);
    // this.editor.setSize(300, 300); // Ensure the editor has a fixed height
    
    // this.editor.setCursor(this.editor.lineCount() - 1, this.editor.getLine(this.editor.lineCount() - 1).length);
   
    this.editor.focus();
    // this.editor.refresh(); // if anything weird happens on load, this usually fixes it. However, this breaks it in this case.
    this.description = this.currentDescription;
    this.title = this.currentTitle;
  }
});
