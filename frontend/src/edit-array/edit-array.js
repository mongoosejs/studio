'use strict';

const template = require('./edit-array.html');

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
appendCSS(require('./edit-array.css'));

module.exports = app => app.component('edit-array', {
  template: template,
  props: ['value'],
  data: () => ({ currentValue: null, editor: null }),
  mounted() {
    this.currentValue = this.value;
    this.editor = new EditorView({
      state: EditorState.create({
        doc: this.currentValue.join('\n'),
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
      parent: this.$refs.arrayEditor
    });
  },
  methods: {
    onUpdate() {
      this.$emit('input', this.currentValue.split('\n'));
    },
  },
  beforeDestroy() {
    if (this.editor) {
      this.editor.toTextArea();
    }
  },
  emits: ['input']
});
