'use strict';

const template = require('./edit-array.html');

const { BSON } = require('bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

function isObjectId(v) {
  return (
    v instanceof BSON.ObjectId || (v && typeof v === 'object' && v._bsontype === 'ObjectId')
  );
}

const appendCSS = require('../appendCSS');
appendCSS(require('./edit-array.css'));

module.exports = app => app.component('edit-array', {
  template: template,
  props: ['value', 'path', 'schemaPaths'],
  data() {
    return {
      arrayValue: [],
      showAddModal: false,
      addItemEditor: null,
      newItemFields: {},
      insertIndex: 0
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
    },
    hasObjectIdFields() {
      if (!this.isArrayOfObjects || !this.path || !this.schemaPaths) {
        return false;
      }
      
      // Get keys from the array items
      const keys = this.objectKeys;
      if (!keys || keys.length === 0) {
        return false;
      }
      
      // Check if any key matches an ObjectId field in schemaPaths
      return keys.some(key => {
        let schemaPath;
        if (Array.isArray(this.schemaPaths)) {
          schemaPath = this.schemaPaths.find(x => x && x.path === key);
        } else {
          schemaPath = this.schemaPaths[key];
        }
        // Check if the instance is ObjectId or has a ref (which indicates ObjectId reference)
        return schemaPath && (schemaPath.instance === 'ObjectId' || schemaPath.ref);
      });
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
      // Handle ObjectIds specially
      if (isObjectId(value)) {
        return value.toString();
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
      if (!this.isArrayOfObjects || key == null || !this.path || !this.schemaPaths) {
        return false;
      }
      const keyStr = String(key);
      // Construct the nested path: e.g., "items.userId" for array field "items" and key "userId"
      const nestedPath = `${this.path.path}.${keyStr}`;
      
      // schemaPaths might be an object (keyed by path) or an array
      let schemaPath;
      if (Array.isArray(this.schemaPaths)) {
        schemaPath = this.schemaPaths.find(sp => sp && sp.path === nestedPath);
      } else {
        schemaPath = this.schemaPaths[nestedPath];
      }
      
      // Check if the schema indicates this field is an ObjectId
      if (schemaPath && schemaPath.instance === 'ObjectId') {
        return true;
      }
      // Also check if it has a ref (which would be an ObjectId reference)
      if (schemaPath && schemaPath.ref) {
        return true;
      }
      return false;
    },
    updateObjectField(index, key, value) {
      if (!this.arrayValue[index]) {
        this.arrayValue[index] = {};
      }
      
      // Ensure value is a string for processing
      if (value == null) {
        value = '';
      }
      const valueStr = String(value);
      const trimmed = valueStr.trim();
      
      // Try to parse as JSON if it looks like JSON, otherwise treat as string
      let parsedValue;
      
      if (trimmed === '') {
        parsedValue = null;
      } else if (trimmed === 'null') {
        parsedValue = null;
      } else if (trimmed === 'true') {
        parsedValue = true;
      } else if (trimmed === 'false') {
        parsedValue = false;
      } else if (this.isObjectIdField(key)) {
        // If this is an ObjectId field, try to create ObjectId
        try {
          if (BSON.ObjectId.isValid && BSON.ObjectId.isValid(trimmed)) {
            parsedValue = new ObjectId(trimmed);
          } else {
            // Keep as string if not valid ObjectId
            parsedValue = valueStr;
          }
        } catch (err) {
          // Keep as string if ObjectId creation fails
          parsedValue = valueStr;
        }
      } else {
        // Try number first (but not if it looks like JSON)
        const numValue = Number(trimmed);
        if (trimmed !== '' && !isNaN(numValue) && isFinite(numValue) && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          parsedValue = numValue;
        } else {
          // Try JSON parse
          try {
            parsedValue = JSON.parse(trimmed);
          } catch {
            // Keep as string
            parsedValue = valueStr;
          }
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
        // Initialize all fields as empty
        const fields = {};
        this.objectKeys.forEach(key => {
          fields[key] = '';
        });
        // Assign the new object to trigger reactivity
        this.newItemFields = Object.assign({}, fields);
      } else {
        this.newItemFields = {};
      }
      
      // Set default insert index to 0
      this.insertIndex = 0;
      
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
    generateObjectIds() {
      if (!this.isArrayOfObjects || !this.path || !this.schemaPaths) {
        return;
      }
      
      // Get keys from the array items
      const keys = this.objectKeys;
      if (!keys || keys.length === 0) {
        return;
      }
      
      // Generate ObjectIds for all ObjectId fields
      const updatedFields = { ...this.newItemFields };
      keys.forEach(key => {
        // Check if this key is an ObjectId field in schemaPaths
        let schemaPath;
        if (Array.isArray(this.schemaPaths)) {
          schemaPath = this.schemaPaths.find(x => x && x.path === key);
        } else {
          schemaPath = this.schemaPaths[key];
        }
        
        // If it's an ObjectId field, generate an ObjectId
        if (schemaPath && (schemaPath.instance === 'ObjectId' || schemaPath.ref)) {
          updatedFields[key] = new ObjectId().toString();
        }
      });
      
      // Update all fields at once to ensure reactivity
      this.newItemFields = updatedFields;
    },
    addItem() {
      try {
        // Ensure arrayValue is initialized
        if (!this.arrayValue || !Array.isArray(this.arrayValue)) {
          this.initializeArray();
        }
        
        // Get insert index (defaults to 0 from input)
        let insertAt = this.insertIndex != null ? Number(this.insertIndex) : this.arrayValue.length;
        if (isNaN(insertAt) || insertAt < 0) {
          insertAt = 0;
        }
        insertAt = Math.floor(insertAt);
        
        let parsed;
        
        if (this.isArrayOfObjects && this.objectKeys.length > 0) {
          // Build object from form fields
          parsed = {};
          this.objectKeys.forEach(key => {
            const value = this.newItemFields[key] || '';
            const valueStr = String(value);
            const trimmed = valueStr.trim();
            
            if (trimmed === '') {
              parsed[key] = null;
            } else if (trimmed === 'null') {
              parsed[key] = null;
            } else if (trimmed === 'true') {
              parsed[key] = true;
            } else if (trimmed === 'false') {
              parsed[key] = false;
            } else if (this.isObjectIdField(key)) {
              // If this is an ObjectId field, try to create ObjectId
              try {
                if (BSON.ObjectId.isValid && BSON.ObjectId.isValid(trimmed)) {
                  parsed[key] = new ObjectId(trimmed);
                } else {
                  // Keep as string if not valid ObjectId
                  parsed[key] = valueStr;
                }
              } catch (err) {
                // Keep as string if ObjectId creation fails
                parsed[key] = valueStr;
              }
            } else {
              // Try number first (but not if it looks like JSON)
              const numValue = Number(trimmed);
              if (trimmed !== '' && !isNaN(numValue) && isFinite(numValue) && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                parsed[key] = numValue;
              } else {
                // Try JSON parse
                try {
                  parsed[key] = JSON.parse(trimmed);
                } catch {
                  // Keep as string
                  parsed[key] = valueStr;
                }
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
        const currentLength = this.arrayValue.length;
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
