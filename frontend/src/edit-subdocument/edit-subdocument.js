'use strict';

const template = require('./edit-subdocument.html');
const { BSON, EJSON } = require('mongodb/lib/bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

module.exports = app => app.component('edit-subdocument', {
  template: template,
  props: ['value'],
  data: () => ({ currentValue: '', status: 'init' }),
  mounted() {
    this.currentValue = this.value == null
      ? '' + this.value
      : JSON.stringify(this.value, null, '  ').trim();
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
  emits: ['input', 'error']
});
