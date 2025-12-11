'use strict';

const template = require('./edit-array.html');

const { BSON } = require('mongodb/lib/bson');

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
      
      // Update CodeMirror editor if it exists
      this.$nextTick(() => {
        if (this.arrayEditor) {
          const arrayStr = JSON.stringify(this.arrayValue, null, 2);
          this.arrayEditor.setValue(arrayStr);
        }
      });
    },
    initializeArrayEditor() {
      this.$nextTick(() => {
        const textareaRef = this.$refs.arrayEditor;
        const textarea = Array.isArray(textareaRef) ? textareaRef[0] : textareaRef;
        if (textarea && !this.arrayEditor) {
          const arrayStr = JSON.stringify(this.arrayValue, null, 2);
          textarea.value = arrayStr;
          this.arrayEditor = CodeMirror.fromTextArea(textarea, {
            mode: 'javascript',
            lineNumbers: true
          });
          this.arrayEditor.on('change', () => {
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
      this.arrayEditor.toTextArea();
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
