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
  data: () => ({ currentValue: null, status: 'init', wasEmpty: true, }),
  mounted() {
    this.currentValue = this.value == null
      ? '' + this.value
      : JSON.stringify(this.value, null, '  ').trim();
    const array = eval(`(${this.currentValue})`);
    if (array.length > 0) {
      this.wasEmpty = false;
    }
    this.$refs.arrayEditor.value = this.currentValue;
    this.editor = CodeMirror.fromTextArea(this.$refs.arrayEditor, {
      mode: 'javascript',
      lineNumbers: true
    });
    this.editor.on('change', ev => {
      this.currentValue = this.editor.getValue();
    });
    this.status = 'loaded';
  },
  watch: {
    currentValue(newVal, oldVal) {
      if (this.status === 'init') {
        return;
      }
      try {
        const array = eval(`(${this.currentValue})`);
        if ((this.wasEmpty && array.length > 0) || (!this.wasEmpty && array.length >= 0)) {
          this.$emit('input', eval(`(${this.currentValue})`));
        }
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
