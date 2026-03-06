'use strict';

const template = require('./ace-editor.html');
const { createAceEditor, destroyAceEditor } = require('../aceEditor');

module.exports = app => app.component('ace-editor', {
  template,
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    // Support :value for explicit binding
    value: {
      type: String,
      default: ''
    },
    mode: {
      type: String,
      default: 'javascript',
      validator: (v) => ['javascript', 'json'].includes(v)
    },
    lineNumbers: {
      type: Boolean,
      default: true
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    wrap: {
      type: Boolean,
      default: false
    },
    minLines: { type: Number, default: null },
    maxLines: { type: Number, default: null }
  },
  emits: ['input', 'update:modelValue'],
  data() {
    return { editor: null };
  },
  computed: {
    boundValue() {
      return this.modelValue !== '' ? this.modelValue : this.value;
    }
  },
  mounted() {
    this.$nextTick(() => {
      const container = this.$refs.container;
      if (!container) return;
      this.editor = createAceEditor(container, {
        value: this.boundValue,
        mode: this.mode,
        lineNumbers: this.lineNumbers,
        readOnly: this.readOnly,
        wrap: this.wrap,
        minLines: this.minLines,
        maxLines: this.maxLines
      });
      this.editor.session.on('change', () => {
        const val = this.editor.getValue();
        this.$emit('input', val);
        this.$emit('update:modelValue', val);
      });
    });
  },
  beforeDestroy() {
    if (this.editor) {
      destroyAceEditor(this.editor);
      this.editor = null;
    }
  },
  watch: {
    modelValue(newVal) {
      const val = newVal ?? '';
      if (this.editor && this.editor.getValue() !== val) {
        this.editor.setValue(val, -1);
      }
    },
    value(newVal) {
      const val = newVal ?? '';
      if (this.editor && this.editor.getValue() !== val) {
        this.editor.setValue(val, -1);
      }
    }
  },
  methods: {
    getValue() {
      return this.editor ? this.editor.getValue() : this.boundValue;
    },
    setValue(val) {
      if (this.editor) {
        this.editor.setValue(val ?? '', -1);
      }
    }
  }
});
