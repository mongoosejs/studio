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
      addingKey: {},
      newKeyNames: {},
      addingModalKey: false,
      newModalKeyName: '',
      modalExtraKeys: []
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
    isCommonKey(key) {
      // A key is "common" if it exists in all objects
      if (!this.isArrayOfObjects || this.arrayValue.length === 0) {
        return false;
      }
      return this.arrayValue.every(item => 
        item != null && typeof item === 'object' && !Array.isArray(item) && key in item
      );
    },
    startAddingKey(index) {
      this.addingKey[index] = true;
      this.newKeyNames[index] = '';
      this.$nextTick(() => {
        const refKey = `newKeyInput-${index}`;
        const inputRef = this.$refs[refKey];
        const input = Array.isArray(inputRef) ? inputRef[0] : inputRef;
        if (input) {
          input.focus();
        }
      });
    },
    cancelAddingKey(index) {
      this.addingKey[index] = false;
      this.newKeyNames[index] = '';
    },
    addKeyToItem(index) {
      const keyName = (this.newKeyNames[index] || '').trim();
      if (keyName && keyName.length > 0) {
        if (!this.arrayValue[index]) {
          this.arrayValue[index] = {};
        }
        if (!(keyName in this.arrayValue[index])) {
          this.arrayValue[index][keyName] = null;
          this.emitUpdate();
        }
      }
      this.cancelAddingKey(index);
    },
    removeObjectKey(index, key) {
      if (this.arrayValue[index] && typeof this.arrayValue[index] === 'object') {
        delete this.arrayValue[index][key];
        this.emitUpdate();
      }
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
    getAllModalKeys() {
      return [...this.objectKeys, ...this.modalExtraKeys];
    },
    startAddingModalKey() {
      this.addingModalKey = true;
      this.newModalKeyName = '';
      this.$nextTick(() => {
        const inputRef = this.$refs.newModalKeyInput;
        const input = Array.isArray(inputRef) ? inputRef[0] : inputRef;
        if (input) {
          input.focus();
        }
      });
    },
    cancelAddingModalKey() {
      this.addingModalKey = false;
      this.newModalKeyName = '';
    },
    addModalKey() {
      const keyName = (this.newModalKeyName || '').trim();
      if (keyName && keyName.length > 0 && !this.getAllModalKeys().includes(keyName)) {
        this.modalExtraKeys.push(keyName);
        this.newItemFields[keyName] = '';
        this.emitUpdate();
      }
      this.cancelAddingModalKey();
    },
    removeModalKey(key) {
      this.modalExtraKeys = this.modalExtraKeys.filter(k => k !== key);
      delete this.newItemFields[key];
    },
    openAddModal() {
      // Initialize form fields for objects
      if (this.isArrayOfObjects) {
        this.newItemFields = {};
        // Pre-populate with all keys from existing objects
        if (this.objectKeys.length > 0) {
          this.objectKeys.forEach(key => {
            this.newItemFields[key] = '';
          });
        }
        this.modalExtraKeys = [];
      }
      
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
      this.modalExtraKeys = [];
      this.addingModalKey = false;
      this.newModalKeyName = '';
      this.showAddModal = false;
    },
    addItem() {
      try {
        let parsed;
        
        if (this.isArrayOfObjects && this.getAllModalKeys().length > 0) {
          // Build object from form fields
          parsed = {};
          this.getAllModalKeys().forEach(key => {
            const value = this.newItemFields[key] || '';
            if (value.trim() === '') {
              parsed[key] = null;
            } else if (value.trim() === 'null') {
              parsed[key] = null;
            } else if (value.trim() === 'true') {
              parsed[key] = true;
            } else if (value.trim() === 'false') {
              parsed[key] = false;
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
        
        this.arrayValue.push(parsed);
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
  beforeDestroy() {
    if (this.addItemEditor) {
      this.addItemEditor.toTextArea();
    }
  },
  emits: ['input', 'error']
});
