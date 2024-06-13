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
  data: () => ({ currentValue: null }),
  mounted() {
    this.currentValue = JSON.stringify(this.value, null, '  ').trim();
    this.editor = new EditorView({
      state: EditorState.create({
        doc: this.currentValue,
        extensions: [
          basicSetup,
          javascript()
        ]
      }),
      parent: this.$refs.arrayEditor
    });
  },
  watch: {
    currentValue() {
      try {
        this.$emit('input', eval(this.currentValue));
      } catch (err) {
        this.$emit('error', err);
      }
    }
  },
  beforeDestroy() {
    if (this.editor) {
      this.editor.toTextArea();
    }
  },
  emits: ['input', 'error']
});
