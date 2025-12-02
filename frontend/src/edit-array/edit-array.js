'use strict';

const template = require('./edit-array.html');

const { BSON } = require('bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

const appendCSS = require('../appendCSS');
appendCSS(require('./edit-array.css'));

module.exports = app => app.component('edit-array', {
  template: template,
  props: ['value'],
  data() {
    return {
      arrayValue: [],
      showAddModal: false,
      addItemEditor: null,
      newItemFields: {},
      insertIndex: null
    };
  },
  computed: {
    isArrayOfObjects() {
      if (!this.arrayValue || this.arrayValue.length === 0) {
        return false;
      }
      // Check if all non-null items are objects
      const nonNullItems = this.arrayValue.filter(item => item != null);
      if (nonNullItems.length === 0) {
        return false;
      }
      return nonNullItems.every(item => typeof item === 'object' && !Array.isArray(item) && item.constructor === Object);
    },
    objectKeys() {
      if (!this.isArrayOfObjects) {
        return [];
      }
      // Collect all unique keys from all objects in the array
      const keys = new Set();
      for (const item of this.arrayValue) {
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          Object.keys(item).forEach(key => keys.add(key));
        }
      }
      return Array.from(keys);
    }
  },
  methods: {
    getItemKeys(index) {
      const item = this.arrayValue[index];
      if (item == null || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }
      return Object.keys(item);
    },
    initializeArray() {
      if (this.value == null) {
        this.arrayValue = [];
      } else if (Array.isArray(this.value)) {
        this.arrayValue = JSON.parse(JSON.stringify(this.value));
      } else {
        this.arrayValue = [];
      }
    },
    getFieldValue(item, key) {
      if (item == null || typeof item !== 'object') {
        return '';
      }
      const value = item[key];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object' && !Array.isArray(value)) {
        return JSON.stringify(value, null, 2);
      }
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (typeof value === 'boolean') {
        return String(value);
      }
      return String(value);
    },
    getFieldPlaceholder(item, key) {
      if (item == null || item[key] == null) {
        return 'null';
      }
      const value = item[key];
      if (typeof value === 'object') {
        return 'object';
      }
      return typeof value;
    },
    isObjectIdField(key) {
      if (!this.isArrayOfObjects) {
        return false;
      }
      // Check if this key typically contains ObjectIds
      let objectIdCount = 0;
      let totalCount = 0;
      for (const item of this.arrayValue) {
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          if (key in item && item[key] != null) {
            totalCount++;
            // Check if value is an ObjectId instance
            if (item[key].constructor && item[key].constructor.name === 'ObjectId') {
              objectIdCount++;
            } else if (BSON.ObjectId.isValid && BSON.ObjectId.isValid(item[key])) {
              objectIdCount++;
            }
          }
        }
      }
      // If more than half of the values for this key are ObjectIds, consider it an ObjectId field
      return totalCount > 0 && objectIdCount > totalCount / 2;
    },
    updateObjectField(index, key, value) {
      if (!this.arrayValue[index]) {
        this.arrayValue[index] = {};
      }
      
      // Try to parse as JSON if it looks like JSON, otherwise treat as string
      let parsedValue = value;
      if (value.trim() === '') {
        parsedValue = null;
      } else if (value.trim() === 'null') {
        parsedValue = null;
      } else if (value.trim() === 'true') {
        parsedValue = true;
      } else if (value.trim() === 'false') {
        parsedValue = false;
      } else if (this.isObjectIdField(key)) {
        // If this is an ObjectId field, try to create ObjectId
        try {
          if (BSON.ObjectId.isValid(value.trim())) {
            parsedValue = new ObjectId(value.trim());
          } else {
            // Keep as string if not valid ObjectId
            parsedValue = value;
          }
        } catch {
          parsedValue = value;
        }
      } else if (!isNaN(value) && value.trim() !== '') {
        // Try number
        parsedValue = Number(value);
      } else {
        // Try JSON parse
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // Keep as string
          parsedValue = value;
        }
      }
      
      this.arrayValue[index][key] = parsedValue;
      this.emitUpdate();
    },
    getInputType(item) {
      if (typeof item === 'number') {
        return 'number';
      }
      return 'text';
    },
    getInputPlaceholder(item) {
      if (item == null) {
        return 'null';
      }
      return typeof item;
    },
    updatePrimitiveItem(index, value) {
      const item = this.arrayValue[index];
      let parsedValue = value;
      
      if (item == null) {
        // Try to infer type from value
        if (value.trim() === '') {
          parsedValue = null;
        } else if (value.trim() === 'null') {
          parsedValue = null;
        } else if (value.trim() === 'true') {
          parsedValue = true;
        } else if (value.trim() === 'false') {
          parsedValue = false;
        } else if (!isNaN(value) && value.trim() !== '') {
          parsedValue = Number(value);
        } else {
          parsedValue = value;
        }
      } else if (typeof item === 'number') {
        parsedValue = value === '' ? null : Number(value);
      } else if (typeof item === 'boolean') {
        parsedValue = value === 'true' || value === true;
      } else {
        parsedValue = value;
      }
      
      this.arrayValue[index] = parsedValue;
      this.emitUpdate();
    },
    removeItem(index) {
      this.arrayValue.splice(index, 1);
      this.emitUpdate();
    },
    validateInsertIndex() {
      if (this.insertIndex < 0) {
        this.insertIndex = 0;
      }
      if (this.insertIndex !== null && !Number.isInteger(this.insertIndex)) {
        this.insertIndex = Math.floor(this.insertIndex);
      }
    },
    copyItem(index) {
      const item = this.arrayValue[index];
      if (item == null) {
        return;
      }
      const copiedItem = JSON.parse(JSON.stringify(item));
      this.arrayValue.splice(index + 1, 0, copiedItem);
      this.emitUpdate();
    },
    openAddModal() {
      // Initialize form fields for objects
      if (this.isArrayOfObjects && this.objectKeys.length > 0) {
        this.newItemFields = {};
        // Pre-populate with all keys from existing objects
        this.objectKeys.forEach(key => {
          this.newItemFields[key] = '';
        });
      }
      
      // Set default insert index to end of array
      this.insertIndex = this.arrayValue ? this.arrayValue.length : 0;
      
      this.showAddModal = true;
      this.$nextTick(() => {
        // Only initialize CodeMirror for non-object arrays
        if (!this.isArrayOfObjects) {
          const textareaRef = this.$refs.addItemEditor;
          const textarea = Array.isArray(textareaRef) ? textareaRef[0] : textareaRef;
          if (textarea) {
            textarea.value = '';
            this.addItemEditor = CodeMirror.fromTextArea(textarea, {
              mode: 'javascript',
              lineNumbers: true
            });
            this.addItemEditor.focus();
          }
        }
      });
    },
    closeAddModal() {
      if (this.addItemEditor) {
        this.addItemEditor.toTextArea();
        this.addItemEditor = null;
      }
      this.newItemFields = {};
      this.insertIndex = null;
      this.showAddModal = false;
    },
    addItem() {
      try {
        // Validate and set insert index
        let insertAt = this.insertIndex;
        if (insertAt === null || insertAt === undefined) {
          insertAt = this.arrayValue ? this.arrayValue.length : 0;
        }
        if (insertAt < 0) {
          insertAt = 0;
        }
        if (!Number.isInteger(insertAt)) {
          insertAt = Math.floor(insertAt);
        }
        
        let parsed;
        
        if (this.isArrayOfObjects && this.objectKeys.length > 0) {
          // Build object from form fields
          parsed = {};
          this.objectKeys.forEach(key => {
            const value = this.newItemFields[key] || '';
            if (value.trim() === '') {
              parsed[key] = null;
            } else if (value.trim() === 'null') {
              parsed[key] = null;
            } else if (value.trim() === 'true') {
              parsed[key] = true;
            } else if (value.trim() === 'false') {
              parsed[key] = false;
            } else if (this.isObjectIdField(key)) {
              // If this is an ObjectId field, try to create ObjectId
              try {
                if (BSON.ObjectId.isValid(value.trim())) {
                  parsed[key] = new ObjectId(value.trim());
                } else {
                  // Keep as string if not valid ObjectId
                  parsed[key] = value;
                }
              } catch {
                parsed[key] = value;
              }
            } else if (!isNaN(value) && value.trim() !== '') {
              parsed[key] = Number(value);
            } else {
              try {
                parsed[key] = JSON.parse(value);
              } catch {
                parsed[key] = value;
              }
            }
          });
        } else if (this.addItemEditor) {
          const value = this.addItemEditor.getValue();
          if (value.trim() === '') {
            parsed = null;
          } else {
            parsed = eval(`(${value})`);
          }
        } else {
          parsed = null;
        }
        
        // Handle inserting beyond array length
        const currentLength = this.arrayValue ? this.arrayValue.length : 0;
        if (insertAt > currentLength) {
          // Pad array with null values up to the insert index
          const paddingNeeded = insertAt - currentLength;
          for (let i = 0; i < paddingNeeded; i++) {
            this.arrayValue.push(null);
          }
        }
        
        // Insert at the specified index (will shift existing items up)
        this.arrayValue.splice(insertAt, 0, parsed);
        this.emitUpdate();
        this.closeAddModal();
      } catch (err) {
        this.$emit('error', err);
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
  beforeDestroy() {
    if (this.addItemEditor) {
      this.addItemEditor.toTextArea();
    }
  },
  watch: {
    value: {
      handler(newValue, oldValue) {
        // Initialize array when value prop changes
        this.initializeArray();
      },
      deep: true,
      immediate: true
    }
  },
  emits: ['input', 'error']
});
