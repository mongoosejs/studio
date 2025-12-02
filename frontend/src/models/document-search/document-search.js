'use strict';

const template = require('./document-search.html');
const { Trie } = require('../trie');

const QUERY_SELECTORS = [
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$exists',
  '$regex',
  '$options',
  '$text',
  '$search',
  '$and',
  '$or',
  '$nor',
  '$not',
  '$elemMatch',
  '$size',
  '$all',
  '$type',
  '$expr',
  '$jsonSchema',
  '$mod'
];

module.exports = app => app.component('document-search', {
  template,
  props: {
    value: {
      type: String,
      default: ''
    },
    schemaPaths: {
      type: Array,
      default: () => []
    }
  },
  data: () => ({
    autocompleteSuggestions: [],
    autocompleteIndex: 0,
    autocompleteTrie: null
  }),
  computed: {
    searchText: {
      get() {
        return this.value || '';
      },
      set(val) {
        this.$emit('input', val);
      }
    }
  },
  watch: {
    schemaPaths: {
      handler() {
        this.buildAutocompleteTrie();
      },
      deep: true
    }
  },
  created() {
    this.buildAutocompleteTrie();
  },
  methods: {
    emitSearch() {
      this.$emit('search');
    },
    buildAutocompleteTrie() {
      this.autocompleteTrie = new Trie();
      this.autocompleteTrie.bulkInsert(QUERY_SELECTORS, 5, 'operator');
      if (Array.isArray(this.schemaPaths) && this.schemaPaths.length > 0) {
        const paths = this.schemaPaths
          .map(path => path?.path)
          .filter(path => typeof path === 'string' && path.length > 0);
        for (const path of this.schemaPaths) {
          if (path.schema) {
            paths.push(...Object.keys(path.schema).map(subpath => `${path.path}.${subpath}`));
          }
        }
        this.autocompleteTrie.bulkInsert(paths, 10, 'fieldName');
      }
    },
    initFilter(ev) {
      if (!this.searchText) {
        this.searchText = '{}';
        this.$nextTick(() => {
          ev.target.setSelectionRange(1, 1);
        });
      }
    },
    updateAutocomplete() {
      const input = this.$refs.searchInput;
      const cursorPos = input ? input.selectionStart : 0;
      const before = this.searchText.slice(0, cursorPos);
      const match = before.match(/(?:\{|,)\s*([^:\s]*)$/);
      if (match && match[1]) {
        const token = match[1];
        const leadingQuoteMatch = token.match(/^["']/);
        const trailingQuoteMatch = token.length > 1 && /["']$/.test(token)
          ? token[token.length - 1]
          : '';
        const term = token
          .replace(/^["']/, '')
          .replace(trailingQuoteMatch ? new RegExp(`[${trailingQuoteMatch}]$`) : '', '')
          .trim();
        if (!term) {
          this.autocompleteSuggestions = [];
          return;
        }

        const colonMatch = before.match(/:\s*([^,\}\]]*)$/);
        const role = colonMatch ? 'operator' : 'fieldName';

        if (this.autocompleteTrie) {
          const primarySuggestions = this.autocompleteTrie.getSuggestions(term, 10, role);
          const suggestionsSet = new Set(primarySuggestions);
          if (Array.isArray(this.schemaPaths) && this.schemaPaths.length > 0) {
            for (const schemaPath of this.schemaPaths) {
              const path = schemaPath?.path;
              if (
                typeof path === 'string' &&
                path.startsWith(`${term}.`) &&
                !suggestionsSet.has(path)
              ) {
                suggestionsSet.add(path);
                if (suggestionsSet.size >= 10) {
                  break;
                }
              }
            }
          }
          let suggestions = Array.from(suggestionsSet);
          if (leadingQuoteMatch) {
            const leadingQuote = leadingQuoteMatch[0];
            suggestions = suggestions.map(suggestion => `${leadingQuote}${suggestion}`);
          }
          if (trailingQuoteMatch) {
            suggestions = suggestions.map(suggestion =>
              suggestion.endsWith(trailingQuoteMatch) ? suggestion : `${suggestion}${trailingQuoteMatch}`
            );
          }
          this.autocompleteSuggestions = suggestions;
          this.autocompleteIndex = 0;
          return;
        }
      }
      this.autocompleteSuggestions = [];
    },
    handleKeyDown(ev) {
      if (this.autocompleteSuggestions.length === 0) {
        return;
      }
      if (ev.key === 'Tab' || ev.key === 'Enter') {
        ev.preventDefault();
        this.applySuggestion(this.autocompleteIndex);
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        this.autocompleteIndex = (this.autocompleteIndex + 1) % this.autocompleteSuggestions.length;
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        this.autocompleteIndex = (this.autocompleteIndex + this.autocompleteSuggestions.length - 1) % this.autocompleteSuggestions.length;
      }
    },
    applySuggestion(index) {
      const suggestion = this.autocompleteSuggestions[index];
      if (!suggestion) {
        return;
      }
      const input = this.$refs.searchInput;
      const cursorPos = input.selectionStart;
      const before = this.searchText.slice(0, cursorPos);
      const after = this.searchText.slice(cursorPos);
      const match = before.match(/(?:\{|,)\s*([^:\s]*)$/);
      const colonNeeded = !/^\s*:/.test(after);
      if (!match) {
        return;
      }
      const token = match[1];
      const start = cursorPos - token.length;
      let replacement = suggestion;
      const leadingQuote = token.startsWith('"') || token.startsWith('\'') ? token[0] : '';
      const trailingQuote = token.length > 1 && (token.endsWith('"') || token.endsWith('\'')) ? token[token.length - 1] : '';
      if (leadingQuote && !replacement.startsWith(leadingQuote)) {
        replacement = `${leadingQuote}${replacement}`;
      }
      if (trailingQuote && !replacement.endsWith(trailingQuote)) {
        replacement = `${replacement}${trailingQuote}`;
      }
      // Only insert : if we know the user isn't entering in a nested path
      if (colonNeeded && (!leadingQuote || trailingQuote)) {
        replacement = `${replacement}:`;
      }
      this.searchText = this.searchText.slice(0, start) + replacement + after;
      this.$nextTick(() => {
        const pos = start + replacement.length;
        input.setSelectionRange(pos, pos);
      });
      this.autocompleteSuggestions = [];
    },
    addPathFilter(path) {
      if (this.searchText) {
        if (this.searchText.endsWith('}')) {
          this.searchText = this.searchText.slice(0, -1) + `, ${path}:  }`;
        } else {
          this.searchText += `, ${path}:  }`;
        }

      } else {
        // If this.searchText is empty or undefined, initialize it with a new object
        this.searchText = `{ ${path}:  }`;
      }


      this.$nextTick(() => {
        const input = this.$refs.searchInput;
        const cursorIndex = this.searchText.lastIndexOf(':') + 2; // Move cursor after ": "

        input.focus();
        input.setSelectionRange(cursorIndex, cursorIndex);
      });
    }
  }
});
