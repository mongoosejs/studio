'use strict';

const api = require('../../api');
const template = require('./analyze-schema-modal.html');
const xss = require('xss');

const TYPE_COLORS = {
  string: '#315f5b',
  number: '#465b86',
  objectid: '#2f6381',
  boolean: '#5b6540',
  date: '#5a5278',
  array: '#6b573d',
  object: '#3f6648',
  mixed: '#62546a',
  buffer: '#5a5f50',
  decimal128: '#4a6474',
  map: '#4e665d',
  null: '#3f4650',
  undefined: '#5b626b'
};

const FALLBACK_TYPE_COLORS = [
  '#315f5b',
  '#465b86',
  '#2f6381',
  '#5b6540',
  '#5a5278',
  '#6b573d',
  '#3f6648',
  '#62546a'
];

module.exports = app => app.component('analyze-schema-modal', {
  template,
  props: ['currentModel'],
  emits: ['close'],
  data: () => ({
    schemaAnalysis: null,
    fieldSearch: '',
    showInvalidDocuments: false,
    typeDisplayMode: 'bars'
  }),
  computed: {
    filteredPaths() {
      if (!this.schemaAnalysis) {
        return [];
      }
      const search = this.fieldSearch.trim().toLowerCase();
      if (!search) {
        return this.schemaAnalysis.paths;
      }
      return this.schemaAnalysis.paths.filter(path => path.path.toLowerCase().includes(search));
    }
  },
  async mounted() {
    window.analyzeSchemaModal = this;
    const { analysis } = await api.Model.analyzeSchema({ model: this.currentModel });
    this.schemaAnalysis = analysis;
    this.$nextTick(() => {
      this.$refs.fieldSearch?.focus();
    });
  },
  unmounted() {
    window.analyzeSchemaModal = null;
  },
  methods: {
    close() {
      this.$emit('close');
    },
    formatNumber(value) {
      if (typeof value !== 'number') {
        return 'Unknown';
      }

      return value.toLocaleString();
    },
    formatPercent(value, total) {
      if (!total) {
        return '0%';
      }
      return `${Math.round((value / total) * 1000) / 10}%`;
    },
    typePercentValue(value, total) {
      if (!total) {
        return 0;
      }
      return Math.round((value / total) * 1000) / 10;
    },
    pathValueCount(path) {
      return typeof path?.valueCount === 'number' && path.valueCount > 0 ?
        path.valueCount :
        this.schemaAnalysis.sampleSize;
    },
    primaryType(path) {
      if (!path || !Array.isArray(path.types) || path.types.length === 0) {
        return null;
      }

      return path.types.find(typeInfo => typeInfo.type !== 'null' && typeInfo.type !== 'undefined') || path.types[0];
    },
    typeColor(type) {
      const normalizedType = String(type || '').toLowerCase();
      if (TYPE_COLORS[normalizedType]) {
        return TYPE_COLORS[normalizedType];
      }

      let hash = 0;
      for (let i = 0; i < normalizedType.length; ++i) {
        hash = ((hash << 5) - hash) + normalizedType.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % FALLBACK_TYPE_COLORS.length;
      return FALLBACK_TYPE_COLORS[index % FALLBACK_TYPE_COLORS.length];
    },
    typeBadgeStyle(type) {
      return {
        backgroundColor: this.typeColor(type),
        color: '#fff'
      };
    },
    typeSegmentStyle(type, count, total) {
      return {
        width: `${this.typePercentValue(count, total)}%`,
        backgroundColor: this.typeColor(type),
        color: '#fff'
      };
    },
    documentRoute(documentId) {
      return `/model/${this.currentModel}/document/${documentId}`;
    },
    highlightPath(path) {
      const search = this.fieldSearch.trim();
      if (!search) {
        return xss(path);
      }

      const index = path.toLowerCase().indexOf(search.toLowerCase());
      if (index === -1) {
        return xss(path);
      }

      const before = path.slice(0, index);
      const match = path.slice(index, index + search.length);
      const after = path.slice(index + search.length);
      return `${xss(before)}<strong>${xss(match)}</strong>${xss(after)}`;
    }
  }
});
