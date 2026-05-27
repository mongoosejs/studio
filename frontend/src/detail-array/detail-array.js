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
    },
    truncate: {
      type: Boolean,
      default: false
    },
    initialLimit: {
      type: Number,
      default: 2
    }
  },
  data() {
    return {
      arrayValue: [],
      arraySearchQuery: '',
      isExpanded: false
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
    },
    displayedArrayRows() {
      if (!this.shouldLimitRows) {
        return this.filteredArrayRows;
      }
      return this.filteredArrayRows.slice(0, this.initialLimit);
    },
    shouldLimitRows() {
      return this.truncate
        && !this.isExpanded
        && !this.arraySearchNormalized
        && this.filteredArrayRows.length > this.initialLimit;
    },
    canToggleRows() {
      return this.truncate && !this.arraySearchNormalized && this.arrayValue.length > this.initialLimit;
    },
    expansionToggleLabel() {
      return this.isExpanded ? 'Show less' : `Show all ${this.arrayValue.length} items`;
    },
    remainingArrayCount() {
      if (!this.shouldLimitRows) {
        return 0;
      }
      return this.filteredArrayRows.length - this.displayedArrayRows.length;
    }
  },
  methods: {
    toggleExpansion() {
      this.isExpanded = !this.isExpanded;
    },
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
        if (this.arrayValue.length <= this.initialLimit) {
          this.isExpanded = false;
        }
      },
      deep: true,
      immediate: true
    }
  }
});
