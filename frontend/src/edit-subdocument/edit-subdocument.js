'use strict';

const template = require('./edit-subdocument.html');

const { createAceEditor, destroyAceEditor } = require('../aceEditor');
const { BSON, EJSON } = require('mongodb/lib/bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

module.exports = app => app.component('edit-subdocument', {
  template: template,
  props: ['value'],
  data: () => ({ currentValue: null, status: 'init' }),
  mounted() {
    this.currentValue = this.value == null
      ? '' + this.value
      : JSON.stringify(this.value, null, '  ').trim();
    const container = this.$refs.editor;
    this.editor = createAceEditor(container, {
      value: this.currentValue,
      mode: 'javascript',
      lineNumbers: true
    });
    this.editor.session.on('change', () => {
      this.currentValue = this.editor.getValue();
    });
    this.status = 'loaded';
  },
  watch: {
    currentValue() {
      if (this.status === 'init') {
        return;
      }
      try {
        this.$emit('input', eval(`(${this.currentValue})`));
      } catch (err) {
        console.log('Error', err);
        this.$emit('error', err);
      }
    }
  },
  beforeDestroy() {
    if (this.editor) {
      destroyAceEditor(this.editor);
    }
  },
  emits: ['input', 'error']
});
