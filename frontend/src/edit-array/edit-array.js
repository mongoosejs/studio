'use strict';

const template = require('./edit-array.html');

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
    this.$refs.arrayEditor.value = this.currentValue;
    this.editor = CodeMirror.fromTextArea(this.$refs.arrayEditor, {
      mode: 'javascript',
      lineNumbers: true
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
