'use strict';

const template = require('./detail-array.html');

module.exports = app => app.component('detail-array', {
  template: template,
  props: ['value'],
  data() {
    return {
      arrayValue: []
    };
  },
  methods: {
    initializeArray() {
      if (this.value == null) {
        this.arrayValue = [];
      } else if (Array.isArray(this.value)) {
        this.arrayValue = this.value;
      } else {
        this.arrayValue = [];
      }
    }
  },
  mounted() {
    this.initializeArray();
  },
  watch: {
    value: {
      handler(newValue) {
        this.initializeArray();
      },
      deep: true,
      immediate: true
    }
  }
});