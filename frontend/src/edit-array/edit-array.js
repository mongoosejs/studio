'use strict';

const template = require('./edit-array.html');
const { BSON } = require('mongodb/lib/bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});


module.exports = app => app.component('edit-array', {
  template: template,
  props: ['value'],
  data() {
    return {
      arrayValue: []
    };
  },
  computed: {
    arrayStr() {
      return JSON.stringify(this.arrayValue, null, 2);
    }
  },
  methods: {
    initializeArray() {
      if (this.value == null) {
        this.arrayValue = [];
      } else if (Array.isArray(this.value)) {
        this.arrayValue = JSON.parse(JSON.stringify(this.value));
      } else {
        this.arrayValue = [];
      }
    },
    onEditorInput(str) {
      try {
        if (str.trim() === '') {
          this.arrayValue = [];
        } else {
          this.arrayValue = JSON.parse(str);
        }
        this.emitUpdate();
      } catch (err) {
        // Invalid JSON, don't update
      }
    },
    emitUpdate() {
      try {
        this.$emit('input', this.arrayValue);
      } catch (err) {
        this.$emit('error', err);
      }
    }
  },
  mounted() {
    this.initializeArray();
  },
  watch: {
    value: {
      handler() {
        this.initializeArray();
      },
      deep: true,
      immediate: true
    }
  },
  emits: ['input', 'error']
});
