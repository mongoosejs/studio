'use strict';

const template = require('./edit-array.html');

const { createAceEditor, destroyAceEditor } = require('../aceEditor');
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
      arrayValue: [],
      arrayEditor: null
    };
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
      
      // Update Ace editor if it exists
      this.$nextTick(() => {
        if (this.arrayEditor) {
          const arrayStr = JSON.stringify(this.arrayValue, null, 2);
          this.arrayEditor.setValue(arrayStr);
        }
      });
    },
    initializeArrayEditor() {
      this.$nextTick(() => {
        const ref = this.$refs.arrayEditor;
        const container = Array.isArray(ref) ? ref[0] : ref;
        if (container && !this.arrayEditor) {
          const arrayStr = JSON.stringify(this.arrayValue, null, 2);
          this.arrayEditor = createAceEditor(container, {
            value: arrayStr,
            mode: 'json',
            lineNumbers: true
          });
          this.arrayEditor.session.on('change', () => {
            this.updateArrayFromEditor();
          });
        }
      });
    },
    updateArrayFromEditor() {
      if (!this.arrayEditor) {
        return;
      }
      try {
        const value = this.arrayEditor.getValue();
        if (value.trim() === '') {
          this.arrayValue = [];
        } else {
          this.arrayValue = JSON.parse(value);
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
    this.initializeArrayEditor();
  },
  beforeDestroy() {
    if (this.arrayEditor) {
      destroyAceEditor(this.arrayEditor);
    }
  },
  watch: {
    value: {
      handler(newValue, oldValue) {
        // Initialize array when value prop changes
        this.initializeArray();
        // Update array editor if it exists
        if (this.arrayEditor) {
          this.$nextTick(() => {
            const arrayStr = JSON.stringify(this.arrayValue, null, 2);
            this.arrayEditor.setValue(arrayStr);
          });
        }
      },
      deep: true,
      immediate: true
    }
  },
  emits: ['input', 'error']
});
