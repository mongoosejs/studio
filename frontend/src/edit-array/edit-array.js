'use strict';

const template = require('./edit-array.html');

const { BSON } = require('bson');

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
  data: () => ({ currentValue: null, status: 'init' }),
  mounted() {
    this.currentValue = this.value == null
      ? '' + this.value
      : JSON.stringify(this.value, null, '  ').trim();
    this.$refs.arrayEditor.value = this.currentValue;
    this.editor = CodeMirror.fromTextArea(this.$refs.arrayEditor, {
      mode: 'javascript',
      lineNumbers: true
    });
    this.editor.on('change', ev => {
      this.currentValue = this.editor.getValue();
    });
  },
  watch: {
    currentValue(newValue, oldValue) {
      // Hacky way of skipping initial trigger because `immediate: false` doesn't work in Vue 3
      if (this.status === 'init') {
        return;
      }
      this.status = 'loaded';
      try {
        const array = eval(`(${this.currentValue})`);
        this.$emit('input', array);
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
