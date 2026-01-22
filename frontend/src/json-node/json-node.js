'use strict';

const template = require('./json-node.html');

module.exports = app => app.component('json-node', {
  name: 'JsonNode',
  template: template,
  props: {
    nodeKey: {
      type: [String, Number],
      default: null
    },
    value: {
      required: true
    },
    level: {
      type: Number,
      required: true
    },
    isLast: {
      type: Boolean,
      default: false
    },
    path: {
      type: String,
      required: true
    },
    toggleCollapse: {
      type: Function,
      required: true
    },
    isCollapsed: {
      type: Function,
      required: true
    },
    createChildPath: {
      type: Function,
      required: true
    },
    indentSize: {
      type: Number,
      required: true
    },
    maxTopLevelFields: {
      type: Number,
      default: null
    },
    topLevelExpanded: {
      type: Boolean,
      default: false
    },
    expandTopLevel: {
      type: Function,
      default: null
    },
    references: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    hasKey() {
      return this.nodeKey !== null && this.nodeKey !== undefined;
    },
    isRoot() {
      return this.path === 'root';
    },
    isArray() {
      return Array.isArray(this.value);
    },
    isObject() {
      if (this.value === null || this.isArray) {
        return false;
      }
      return Object.prototype.toString.call(this.value) === '[object Object]';
    },
    isComplex() {
      return this.isArray || this.isObject;
    },
    children() {
      if (!this.isComplex) {
        return [];
      }
      if (this.isArray) {
        return this.value.map((childValue, index) => ({
          displayKey: null,
          value: childValue,
          isLast: index === this.value.length - 1,
          path: this.createChildPath(this.path, index, true)
        }));
      }
      const keys = Object.keys(this.value);
      const visibleKeys = this.visibleObjectKeys(keys);
      const hasHidden = this.hasHiddenRootChildren;
      return visibleKeys.map((key, index) => ({
        displayKey: key,
        value: this.value[key],
        isLast: !hasHidden && index === visibleKeys.length - 1,
        path: this.createChildPath(this.path, key, false)
      }));
    },
    hasChildren() {
      return this.children.length > 0;
    },
    totalObjectChildCount() {
      if (!this.isObject) {
        return 0;
      }
      return Object.keys(this.value).length;
    },
    hasHiddenRootChildren() {
      if (!this.isRoot || !this.isObject) {
        return false;
      }
      if (this.topLevelExpanded) {
        return false;
      }
      if (typeof this.maxTopLevelFields !== 'number') {
        return false;
      }
      return this.totalObjectChildCount > this.maxTopLevelFields;
    },
    hiddenRootChildrenCount() {
      if (!this.hasHiddenRootChildren) {
        return 0;
      }
      return this.totalObjectChildCount - this.maxTopLevelFields;
    },
    showToggle() {
      return this.hasChildren && !this.isRoot;
    },
    openingBracket() {
      return this.isArray ? '[' : '{';
    },
    closingBracket() {
      return this.isArray ? ']' : '}';
    },
    isCollapsedNode() {
      return this.isCollapsed(this.path);
    },
    formattedValue() {
      if (typeof this.value === 'bigint') {
        return `${this.value.toString()}n`;
      }
      const stringified = JSON.stringify(this.value);
      if (stringified === undefined) {
        if (typeof this.value === 'symbol') {
          return this.value.toString();
        }
        return String(this.value);
      }
      return stringified;
    },
    valueClasses() {
      const classes = ['text-slate-700'];
      if (this.value === null) {
        classes.push('text-gray-500', 'italic');
        return classes;
      }
      const type = typeof this.value;
      if (type === 'string') {
        classes.push('text-emerald-600');
        return classes;
      }
      if (type === 'number' || type === 'bigint') {
        classes.push('text-amber-600');
        return classes;
      }
      if (type === 'boolean') {
        classes.push('text-violet-600');
        return classes;
      }
      if (type === 'undefined') {
        classes.push('text-gray-500');
        return classes;
      }
      return classes;
    },
    comma() {
      return this.isLast ? '' : ',';
    },
    indentStyle() {
      return {
        paddingLeft: `${this.level * this.indentSize}px`
      };
    },
    hiddenChildrenLabel() {
      if (!this.hasHiddenRootChildren) {
        return '';
      }
      const count = this.hiddenRootChildrenCount;
      const suffix = count === 1 ? 'field' : 'fields';
      return `${count} more ${suffix}`;
    },
    hiddenChildrenTooltip() {
      return this.hiddenChildrenLabel;
    },
    normalizedPath() {
      if (typeof this.path !== 'string') {
        return '';
      }
      return this.path
        .replace(/^root\.?/, '')
        .replace(/\[\d+\]/g, '')
        .replace(/^\./, '');
    },
    referenceModel() {
      if (!this.normalizedPath || !this.references) {
        return null;
      }
      return this.references[this.normalizedPath] || null;
    },
    shouldShowReferenceLink() {
      return this.referenceId != null;
    },
    referenceId() {
      if (!this.referenceModel) {
        return null;
      }
      if (this.value == null) {
        return null;
      }
      const type = typeof this.value;
      if (type === 'string' || type === 'number' || type === 'bigint') {
        return String(this.value);
      }
      if (type === 'object') {
        if (this.value._id != null) {
          return String(this.value._id);
        }
        if (typeof this.value.toString === 'function') {
          const stringified = this.value.toString();
          if (typeof stringified === 'string' && stringified !== '[object Object]') {
            return stringified;
          }
        }
      }
      return null;
    }
  },
  methods: {
    visibleObjectKeys(keys) {
      if (!this.isRoot || this.topLevelExpanded) {
        return keys;
      }
      if (typeof this.maxTopLevelFields !== 'number') {
        return keys;
      }
      if (keys.length <= this.maxTopLevelFields) {
        return keys;
      }
      return keys.slice(0, this.maxTopLevelFields);
    },
    handleToggle() {
      if (!this.isRoot) {
        this.toggleCollapse(this.path);
      }
    },
    handleExpandTopLevel() {
      if (this.isRoot && typeof this.expandTopLevel === 'function') {
        this.expandTopLevel();
      }
    },
    goToReference() {
      const id = this.referenceId;
      if (!this.referenceModel || id == null) {
        return;
      }
      this.$router.push({ path: `/model/${this.referenceModel}/document/${id}` });
    }
  }
});
