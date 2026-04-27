'use strict';

const template = require('./detail-array.html');
const { isArrayOfObjects, unionKeysForArrayOfObjects, arrayItemMatchesSearch } = require('../array-utils');

module.exports = app => app.component('detail-array', {
  template: template,
  props: {
    value: {},
    /** 'list' | 'table' — table applies to arrays of plain objects */
    viewMode: {
      type: String,
      default: 'list'
    }
  },
  data() {
    return {
      arrayValue: [],
      arraySearchQuery: ''
    };
  },
  computed: {
    effectiveViewMode() {
      return this.viewMode === 'table' ? 'table' : 'list';
    },
    showAsTable() {
      return this.effectiveViewMode === 'table' && isArrayOfObjects(this.arrayValue);
    },
    tableColumnKeys() {
      return unionKeysForArrayOfObjects(this.arrayValue);
    },
    arraySearchNormalized() {
      return (this.arraySearchQuery || '').trim().toLowerCase();
    },
    filteredArrayRows() {
      if (!Array.isArray(this.arrayValue)) {
        return [];
      }
      return this.arrayValue
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => arrayItemMatchesSearch(item, this.arraySearchNormalized));
    }
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