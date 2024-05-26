'use strict';

const api = require('../api');
const { EditorState } = require('@codemirror/state');
const { lineNumbers } = require('@codemirror/view')
const { EditorView, basicSetup } = require('codemirror');
const { javascript } = require('@codemirror/lang-javascript');

const { BSON, EJSON } = require('bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply (target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

const appendCSS = require('../appendCSS');

appendCSS(require('./create-document.css'));

const template = require('./create-document.html')

module.exports = app => app.component('create-document', {
  props: ['currentModel', 'paths'],
  template,
  data: function() {
    return {
      documentData: '',
      editor: null
    }
  },
  methods: {
    async createDocument() {
      const data = EJSON.serialize(eval(`(${this.documentData})`));
      const { doc } = await api.Model.createDocument({ model: this.currentModel, data }).catch(err => {
        if (err.response?.data?.message) {
          throw new Error(err.response?.data?.message);
        }
        throw err;
      });
      this.$emit('close', doc);
    },
  },
  mounted: function() {
    console.log(this.currentModel, this.paths);
    const requiredPaths = this.paths.filter(x => x.required);
    this.documentData = `{\n`;
    for (let i = 0; i < requiredPaths.length; i++) {
      const isLast = i + 1 >= requiredPaths.length;
      this.documentData += `  ${requiredPaths[i].path}: ${isLast ? '': ','}\n`
    }
    this.documentData += '}';
    
    this.editor = new EditorView({
      state: EditorState.create({
        doc: this.documentData,
        extensions: [
          basicSetup,
          javascript(),
          // history(),
          EditorView.updateListener.of((v) => {
            // Your update logic here
          }),
          // keymap.of(historyKeymap)
        ]
      }),
      parent: this.$refs.codeEditor
    });
  },
  beforeDestroy() {
    if (this.editor) {
      this.editor.toTextArea();
    }
  }
})