'use strict';

const template = require('./edit-array.html');
const { BSON } = require('mongodb/lib/bson');
const { isArrayOfObjects, unionKeysForArrayOfObjects, arrayItemMatchesSearch } = require('../array-utils');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});


module.exports = app => app.component('edit-array', {
  template: template,
  props: {
    value: {},
    path: {},
    schemaPaths: {},
    /** 'json' (ACE) or 'table' for arrays of plain objects */
    viewMode: {
      type: String,
      default: 'json'
    }
  },
  data() {
    return {
      arrayValue: [],
      newColumnKeyInput: '',
      newColumnKeyError: '',
      arraySearchQuery: ''
    };
  },
  computed: {
    arrayStr() {
      return JSON.stringify(this.arrayValue, null, 2);
    },
    useTableEditor() {
      return this.viewMode === 'table' && isArrayOfObjects(this.arrayValue);
    },
    tableColumnKeys() {
      return unionKeysForArrayOfObjects(this.arrayValue);
    },
    arraySearchNormalized() {
      return (this.arraySearchQuery || '').trim().toLowerCase();
    },
    filteredTableRows() {
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
    },
    serializeCell(value) {
      if (value === undefined) {
        return '';
      }
      return JSON.stringify(value);
    },
    onCellChange(rowIndex, key, raw) {
      const row = this.arrayValue[rowIndex];
      if (row == null || typeof row !== 'object') {
        return;
      }
      const trimmed = raw.trim();
      if (trimmed === '') {
        delete row[key];
        this.emitUpdate();
        return;
      }
      try {
        row[key] = JSON.parse(trimmed);
        this.emitUpdate();
      } catch (err) {
        this.$emit('error', err);
      }
    },
    addRow() {
      const row = {};
      for (const k of this.tableColumnKeys) {
        row[k] = null;
      }
      this.arrayValue.push(row);
      this.emitUpdate();
    },
    addColumn() {
      const key = (this.newColumnKeyInput || '').trim();
      this.newColumnKeyError = '';
      if (!key) {
        this.newColumnKeyError = 'Enter a column name.';
        return;
      }
      if (this.tableColumnKeys.includes(key)) {
        this.newColumnKeyError = 'That column already exists.';
        return;
      }
      if (!Array.isArray(this.arrayValue)) {
        this.arrayValue = [];
      }
      if (this.arrayValue.length === 0) {
        this.arrayValue.push({ [key]: null });
      } else {
        for (const row of this.arrayValue) {
          if (row != null && typeof row === 'object' && !Array.isArray(row) && row.constructor === Object) {
            row[key] = null;
          }
        }
      }
      this.newColumnKeyInput = '';
      this.emitUpdate();
    },
    removeRow(index) {
      this.arrayValue.splice(index, 1);
      this.emitUpdate();
    },
    moveRow(index, delta) {
      const j = index + delta;
      if (j < 0 || j >= this.arrayValue.length) {
        return;
      }
      const copy = this.arrayValue[index];
      this.arrayValue.splice(index, 1);
      this.arrayValue.splice(j, 0, copy);
      this.emitUpdate();
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
