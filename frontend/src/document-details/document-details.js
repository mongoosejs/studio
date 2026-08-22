'use strict';

const mpath = require('mpath');
const template = require('./document-details.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./document-details.css'));

module.exports = app => app.component('document-details', {
  template,
  props: ['document', 'schemaPaths', 'virtualPaths', 'editting', 'changes', 'invalid', 'viewMode'],
  data() {
    return {
      searchQuery: '',
      selectedType: '',
      collapsedVirtuals: new Set()
    };
  },
  mounted() {
    // Focus on search input when component loads
    this.$nextTick(() => {
      if (this.$refs.searchInput) {
        this.$refs.searchInput.focus();
      }
    });

    this.searchQuery = this.getSearchQueryFromRoute();
  },
  watch: {
    searchQuery(newValue) {
      this.syncSearchQueryToUrl(newValue);
    },
    '$route.query.fieldSearch': {
      handler(newValue) {
        const nextValue = typeof newValue === 'string' ? newValue : '';
        if (nextValue !== this.searchQuery) {
          this.searchQuery = nextValue;
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
    typeFilteredSchemaPaths() {
      let paths = this.schemaPaths || [];

      if (this.selectedType) {
        paths = paths.filter(path => path.instance === this.selectedType);
      }

      return paths;
    },
    filteredSchemaPaths() {
      const paths = this.typeFilteredSchemaPaths.slice();

      if (!this.searchQuery.trim()) {
        return paths;
      }

      const query = this.searchQuery.toLowerCase();
      const matches = [];
      const nonMatches = [];

      paths.forEach(path => {
        if (path.path.toLowerCase().includes(query)) {
          matches.push(path);
        } else {
          nonMatches.push(path);
        }
      });

      return matches.concat(nonMatches);
    },
    matchedSchemaPaths() {
      if (!this.searchQuery.trim()) {
        return [];
      }
      const query = this.searchQuery.toLowerCase();
      return this.typeFilteredSchemaPaths.filter(path => path.path.toLowerCase().includes(query));
    },
    unmatchedSchemaPaths() {
      if (!this.searchQuery.trim()) {
        return this.typeFilteredSchemaPaths;
      }
      const query = this.searchQuery.toLowerCase();
      return this.typeFilteredSchemaPaths.filter(path => !path.path.toLowerCase().includes(query));
    },
    typeFilteredVirtuals() {
      let virtuals = this.virtuals;

      if (this.selectedType) {
        virtuals = virtuals.filter(virtual => {
          const virtualType = this.getVirtualFieldType(virtual);
          return virtualType === this.selectedType;
        });
      }

      return virtuals;
    },
    filteredVirtuals() {
      const virtuals = this.typeFilteredVirtuals.slice();

      if (!this.searchQuery.trim()) {
        return virtuals;
      }

      const query = this.searchQuery.toLowerCase();
      const matches = [];
      const nonMatches = [];

      virtuals.forEach(virtual => {
        if (virtual.name.toLowerCase().includes(query)) {
          matches.push(virtual);
        } else {
          nonMatches.push(virtual);
        }
      });

      return matches.concat(nonMatches);
    },
    matchedVirtuals() {
      if (!this.searchQuery.trim()) {
        return [];
      }
      const query = this.searchQuery.toLowerCase();
      return this.typeFilteredVirtuals.filter(virtual => virtual.name.toLowerCase().includes(query));
    },
    unmatchedVirtuals() {
      if (!this.searchQuery.trim()) {
        return this.typeFilteredVirtuals;
      }
      const query = this.searchQuery.toLowerCase();
      return this.typeFilteredVirtuals.filter(virtual => !virtual.name.toLowerCase().includes(query));
    },
    schemaSearchMatchSet() {
      if (!this.searchQuery.trim()) {
        return new Set();
      }

      const query = this.searchQuery.toLowerCase();
      return new Set(
        this.typeFilteredSchemaPaths
          .filter(path => path.path.toLowerCase().includes(query))
          .map(path => path.path)
      );
    },
    virtualSearchMatchSet() {
      if (!this.searchQuery.trim()) {
        return new Set();
      }

      const query = this.searchQuery.toLowerCase();
      return new Set(
        this.typeFilteredVirtuals
          .filter(virtual => virtual.name.toLowerCase().includes(query))
          .map(virtual => virtual.name)
      );
    },
    hasSearchMatches() {
      if (!this.searchQuery.trim()) {
        return true;
      }

      return this.schemaSearchMatchSet.size > 0 || this.virtualSearchMatchSet.size > 0;
    },
    formattedJson() {
      if (!this.document) {
        return '{}';
      }
      return JSON.stringify(this.document, null, 2);
    }
  },
  methods: {
    getSearchQueryFromRoute() {
      return this.$route?.query?.fieldSearch || '';
    },
    syncSearchQueryToUrl(value) {
      if (typeof window === 'undefined') {
        return;
      }

      const normalizedValue = typeof value === 'string' ? value : '';
      const shouldStore = normalizedValue.trim().length > 0;
      const hash = window.location.hash.replace(/^#?/, '');
      const [hashPath, hashQueryString = ''] = hash.split('?');
      const params = new URLSearchParams(hashQueryString);
      const currentValue = params.get('fieldSearch') || '';

      if (normalizedValue === currentValue || (!shouldStore && !currentValue)) {
        return;
      }

      if (shouldStore) {
        params.set('fieldSearch', normalizedValue);
      } else {
        params.delete('fieldSearch');
      }

      const nextQueryString = params.toString();
      const nextHash = nextQueryString ? `${hashPath}?${nextQueryString}` : hashPath;
      window.history.replaceState(window.history.state, '', `#${nextHash}`);
    },
    toggleVirtualField(fieldName) {
      if (this.collapsedVirtuals.has(fieldName)) {
        this.collapsedVirtuals.delete(fieldName);
      } else {
        this.collapsedVirtuals.add(fieldName);
      }
    },
    isSchemaPathMatched(path) {
      if (!path) {
        return false;
      }

      return this.schemaSearchMatchSet.has(path.path);
    },
    isVirtualMatched(virtual) {
      if (!virtual) {
        return false;
      }

      return this.virtualSearchMatchSet.has(virtual.name);
    },
    getSearchMatchParts(text) {
      const normalizedQuery = typeof this.searchQuery === 'string' ? this.searchQuery.trim() : '';
      if (!normalizedQuery) {
        return [{ text, matched: false }];
      }

      const lowerText = String(text).toLowerCase();
      const lowerQuery = normalizedQuery.toLowerCase();
      const parts = [];
      let position = 0;
      let matchIndex = lowerText.indexOf(lowerQuery, position);

      while (matchIndex !== -1) {
        if (matchIndex > position) {
          parts.push({ text: text.slice(position, matchIndex), matched: false });
        }
        const matchEnd = matchIndex + normalizedQuery.length;
        parts.push({ text: text.slice(matchIndex, matchEnd), matched: true });
        position = matchEnd;
        matchIndex = lowerText.indexOf(lowerQuery, position);
      }

      if (position < text.length) {
        parts.push({ text: text.slice(position), matched: false });
      }

      return parts.length > 0 ? parts : [{ text, matched: false }];
    },
    isVirtualFieldCollapsed(fieldName) {
      return this.collapsedVirtuals.has(fieldName);
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
    }
  }
});
