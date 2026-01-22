'use strict';

const template = require('./list-json.html');

module.exports = app => app.component('list-json', {
  template: template,
  props: {
    value: {
      required: true
    },
    references: {
      type: Object,
      default: () => ({})
    },
    maxTopLevelFields: {
      type: Number,
      default: 15
    },
    expandedFields: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      collapsedMap: {},
      indentSize: 16,
      topLevelExpanded: false
    };
  },
  watch: {
    value: {
      handler() {
        this.resetCollapse();
      }
    }
  },
  created() {
    this.resetCollapse();
    for (const field of this.expandedFields) {
      this.toggleCollapse(field);
    }
  },
  methods: {
    resetCollapse() {
      this.collapsedMap = {};
      this.topLevelExpanded = false;
    },
    toggleCollapse(path) {
      const current = this.isPathCollapsed(path);
      this.collapsedMap = Object.assign({}, this.collapsedMap, { [path]: !current });
    },
    isPathCollapsed(path) {
      if (path === 'root') {
        return false;
      }
      if (Object.prototype.hasOwnProperty.call(this.collapsedMap, path)) {
        return this.collapsedMap[path];
      }
      return true;
    },
    createChildPath(parentPath, childKey, isArray) {
      if (parentPath == null || parentPath === '') {
        return isArray ? `[${childKey}]` : `${childKey}`;
      }
      if (parentPath === 'root') {
        return isArray ? `root[${childKey}]` : `root.${childKey}`;
      }
      if (isArray) {
        return `${parentPath}[${childKey}]`;
      }
      return `${parentPath}.${childKey}`;
    },
    expandTopLevel() {
      this.topLevelExpanded = true;
    }
  }
});
