'use strict';

const mpath = require('mpath');
const template = require('./document-details.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./document-details.css'));

module.exports = app => app.component('document-details', {
  template,
  props: ['document', 'schemaPaths', 'virtualPaths', 'editting', 'changes', 'invalid'],
  data() {
    return {
      searchQuery: '',
      selectedType: '',
      collapsedVirtuals: new Set(),
      showAddFieldModal: false,
      viewMode: 'fields', // 'fields' or 'json'
      fieldData: {
        name: '',
        type: '',
        value: ''
      },
      fieldErrors: {},
      isSubmittingField: false,
      fieldValueEditor: null
    };
  },
  mounted() {
    // Focus on search input when component loads
    this.$nextTick(() => {
      if (this.$refs.searchInput) {
        this.$refs.searchInput.focus();
      }
      
      if (this.showAddFieldModal) {
        this.initializeFieldValueEditor();
      }
    });
  },
  beforeDestroy() {
    this.destroyFieldValueEditor();
  },
  watch: {
    'fieldData.type'(newType, oldType) {
      // When field type changes, we need to handle the transition
      if (newType !== oldType) {
        // Destroy existing CodeMirror if it exists
        this.destroyFieldValueEditor();
        
        // If switching to a type that needs CodeMirror, initialize it
        if (this.shouldUseCodeMirror) {
          this.$nextTick(() => {
            this.initializeFieldValueEditor();
          });
        }
      }
    }
  },
  computed: {
    virtuals() {
      if (this.schemaPaths == null) {
        return [];
      }
      if (this.document == null) {
        return [];
      }
      const exists = this.schemaPaths.map(x => x.path);
      const docKeys = Object.keys(this.document);
      const result = [];
      for (let i = 0; i < docKeys.length; i++) {
        if (!exists.includes(docKeys[i])) {
          const isVirtual = this.virtualPaths && this.virtualPaths.includes(docKeys[i]);
          result.push({ 
            name: docKeys[i], 
            value: this.document[docKeys[i]],
            isVirtual: isVirtual,
            isUserAdded: !isVirtual
          });
        }
      }

      return result;
    },
    availableTypes() {
      if (!this.schemaPaths) return [];
      const types = new Set();
      this.schemaPaths.forEach(path => {
        if (path.instance) {
          types.add(path.instance);
        }
      });
      
      // Add virtual field types to the available types
      this.virtuals.forEach(virtual => {
        const virtualType = this.getVirtualFieldType(virtual);
        if (virtualType && virtualType !== 'unknown') {
          types.add(virtualType);
        }
      });
      
      return Array.from(types).sort();
    },
    allFieldTypes() {
      const schemaTypes = this.availableTypes;
      const commonTypes = ['String', 'Number', 'Boolean', 'Date', 'Array', 'Object'];
      
      // Combine schema types with common types, avoiding duplicates
      const allTypes = new Set([...schemaTypes, ...commonTypes]);
      return Array.from(allTypes).sort();
    },
    shouldUseCodeMirror() {
      return ['Array', 'Object', 'Embedded'].includes(this.fieldData.type);
    },
    shouldUseDatePicker() {
      return this.fieldData.type === 'Date';
    },
    filteredSchemaPaths() {
      let paths = this.schemaPaths || [];
      
      // Filter by search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        paths = paths.filter(path => 
          path.path.toLowerCase().includes(query)
        );
      }
      
      // Filter by data type
      if (this.selectedType) {
        paths = paths.filter(path => 
          path.instance === this.selectedType
        );
      }
      
      return paths;
    },
    filteredVirtuals() {
      let virtuals = this.virtuals;
      
      // Filter by search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        virtuals = virtuals.filter(virtual => 
          virtual.name.toLowerCase().includes(query)
        );
      }
      
      // Filter by data type
      if (this.selectedType) {
        virtuals = virtuals.filter(virtual => {
          const virtualType = this.getVirtualFieldType(virtual);
          return virtualType === this.selectedType;
        });
      }
      
      return virtuals;
    },
    formattedJson() {
      if (!this.document) {
        return '{}';
      }
      return JSON.stringify(this.document, null, 2);
    }
  },
  methods: {
    toggleVirtualField(fieldName) {
      if (this.collapsedVirtuals.has(fieldName)) {
        this.collapsedVirtuals.delete(fieldName);
      } else {
        this.collapsedVirtuals.add(fieldName);
      }
    },
    isVirtualFieldCollapsed(fieldName) {
      return this.collapsedVirtuals.has(fieldName);
    },
    openAddFieldModal() {
      this.showAddFieldModal = true;
      this.$nextTick(() => {
        if (this.shouldUseCodeMirror) {
          this.initializeFieldValueEditor();
        }
      });
    },
    closeAddFieldModal() {
      this.showAddFieldModal = false;
      this.destroyFieldValueEditor();
      this.resetFieldForm();
    },
    async addNewField(fieldData) {
      // Emit event to parent component to handle the field addition
      this.$emit('add-field', fieldData);
      this.closeAddFieldModal();
    },
    validateFieldForm() {
      this.fieldErrors = {};
      
      // Validate field name
      const trimmedName = this.fieldData.name.trim();
      if (!trimmedName) {
        this.fieldErrors.name = 'Field name is required';
      } else {
        const transformedName = this.getTransformedFieldName();
        if (!transformedName) {
          this.fieldErrors.name = 'Field name contains only invalid characters';
        } else if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(transformedName)) {
          this.fieldErrors.name = 'Field name must start with a letter, underscore, or $ and contain only letters, numbers, underscores, and $';
        }
      }
      
      // Validate field type
      if (!this.fieldData.type) {
        this.fieldErrors.type = 'Field type is required';
      }
      
      // Validate field value if provided
      if (this.fieldData.value && this.fieldData.value.trim()) {
        if (['Object', 'Array'].includes(this.fieldData.type)) {
          try {
            JSON.parse(this.fieldData.value);
          } catch (e) {
            this.fieldErrors.value = 'Invalid JSON format for object/array type';
          }
        } else if (this.fieldData.type === 'Number') {
          if (isNaN(Number(this.fieldData.value))) {
            this.fieldErrors.value = 'Invalid number format';
          }
        } else if (this.fieldData.type === 'Boolean') {
          const lowerValue = this.fieldData.value.toLowerCase();
          if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lowerValue)) {
            this.fieldErrors.value = 'Invalid boolean value (use true/false, 1/0, yes/no)';
          }
        } else if (this.fieldData.type === 'Date') {
          // Date picker provides YYYY-MM-DD format, validate it
          const dateValue = new Date(this.fieldData.value);
          if (isNaN(dateValue.getTime())) {
            this.fieldErrors.value = 'Invalid date format';
          }
        }
      }
      
      return Object.keys(this.fieldErrors).length === 0;
    },
    parseFieldValue(value, type) {
      if (!value || !value.trim()) {
        return null;
      }
      
      switch (type) {
        case 'Number':
          return Number(value);
        case 'Boolean':
          const lowerValue = value.toLowerCase();
          return ['true', '1', 'yes'].includes(lowerValue);
        case 'Date':
          // For date picker, value is already in YYYY-MM-DD format
          return new Date(value);
        case 'Object':
        case 'Array':
          return JSON.parse(value);
        default:
          return value;
      }
    },
    async handleAddFieldSubmit() {
      if (!this.validateFieldForm()) {
        return;
      }
      
      this.isSubmittingField = true;
      
      try {
        const fieldData = {
          name: this.getTransformedFieldName(),
          type: this.fieldData.type,
          value: this.parseFieldValue(this.fieldData.value, this.fieldData.type)
        };
        
        this.$emit('add-field', fieldData);
        this.closeAddFieldModal();
      } catch (error) {
        console.error('Error adding field:', error);
        this.fieldErrors.value = 'Error processing field value';
      } finally {
        this.isSubmittingField = false;
      }
    },
    resetFieldForm() {
      this.fieldData = {
        name: '',
        type: '',
        value: ''
      };
      this.fieldErrors = {};
      this.isSubmittingField = false;
      // Reset CodeMirror editor if it exists
      if (this.fieldValueEditor) {
        this.fieldValueEditor.setValue('');
      }
    },
    initializeFieldValueEditor() {
      if (this.$refs.fieldValueEditor && !this.fieldValueEditor && this.shouldUseCodeMirror) {
        this.$refs.fieldValueEditor.value = this.fieldData.value || '';
        this.fieldValueEditor = CodeMirror.fromTextArea(this.$refs.fieldValueEditor, {
          mode: 'javascript',
          lineNumbers: true,
          height: 'auto'
        });
        this.fieldValueEditor.on('change', () => {
          this.fieldData.value = this.fieldValueEditor.getValue();
        });
      }
    },
    destroyFieldValueEditor() {
      if (this.fieldValueEditor) {
        this.fieldValueEditor.toTextArea();
        this.fieldValueEditor = null;
      }
    },
    toSnakeCase(str) {
      return str
        .trim()
        .replace(/\s+/g, '_')  // Replace spaces with underscores
        .replace(/[^a-zA-Z0-9_$]/g, '')  // Remove invalid characters
        .replace(/^[0-9]/, '_$&')  // Prefix numbers with underscore
        .toLowerCase();
    },
    getTransformedFieldName() {
      if (!this.fieldData.name) return '';
      return this.toSnakeCase(this.fieldData.name.trim());
    },
    getVirtualFieldType(virtual) {
      const value = virtual.value;
      if (value === null || value === undefined) {
        return 'null';
      }
      if (Array.isArray(value)) {
        return 'Array';
      }
      if (value instanceof Date) {
        return 'Date';
      }
      if (typeof value === 'object') {
        return 'Object';
      }
      if (typeof value === 'number') {
        return 'Number';
      }
      if (typeof value === 'boolean') {
        return 'Boolean';
      }
      if (typeof value === 'string') {
        return 'String';
      }
      return 'unknown';
    },
    setViewMode(mode) {
      this.viewMode = mode;
      this.$emit('view-mode-change', mode);
    }
  }
});