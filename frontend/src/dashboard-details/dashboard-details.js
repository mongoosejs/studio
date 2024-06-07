'use strict';

const api = require('../api');
const template = require('./dashboard-details.html');

const { EditorState } = require('@codemirror/state');
const { lineNumbers } = require('@codemirror/view')
const { EditorView, basicSetup } = require('codemirror');
const { javascript } = require('@codemirror/lang-javascript');

module.exports = app => app.component('dashboard-details', {
  template: template,
  props: ['dashboard'],
  data: function() {
    return {
      code: '',
      editor: null,
      showEditor: false,
      payload: ''
    }
  },
  methods: {
    toggleEditor() {
      this.showEditor = !this.showEditor;
    },
    async updateCode() {
      const { doc } = await api.Dashboard.updateDashboard({ dashboardId: this.dashboard._id, code: this.payload });
      this.code = doc.code;
      this.showEditor = false;
    }
  },
  mounted: function() {
    this.editor = new EditorView({
      state: EditorState.create({
        doc: this.dashboard.code.toString(),
        extensions: [
          basicSetup,
          javascript(),
          // history(),
          EditorView.updateListener.of((v) => {
          }),
          // keymap.of(historyKeymap)
        ]
      }),
      parent: this.$refs.codeEditor
    });
    this.code = this.dashboard.code;
    this.payload = this.code;
  },
  beforeDestroy() {
    if (this.editor) {
      this.editor.toTextArea();
    }
  }
});
