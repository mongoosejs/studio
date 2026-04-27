'use strict';

const template = require('./document-search.html');
const {
  buildAutocompleteTrie,
  getAutocompleteSuggestions,
  applySuggestion,
  getDatePickerInsertionRange,
  dateArgumentSliceToDatetimeLocal,
  insertQuotedIsoInDateArgument
} = require('../../_util/document-search-autocomplete');

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
  data() {
    return {
      autocompleteSuggestions: [],
      autocompleteIndex: 0,
      autocompleteTrie: null,
      searchText: this.value || '',
      datePickerContext: null,
      datePickerLocalValue: ''
    };
  },
  watch: {
    value(val) {
      this.searchText = val || '';
    },
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
  mounted() {
    this.$refs.searchInput.focus();
  },
  methods: {
    emitSearch() {
      this.$emit('input', this.searchText);
      this.$emit('search', this.searchText);
    },
    buildAutocompleteTrie() {
      this.autocompleteTrie = buildAutocompleteTrie(this.schemaPaths);
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

      const dateRange = getDatePickerInsertionRange(this.searchText, cursorPos);
      this.datePickerContext = dateRange;
      if (dateRange) {
        const argSlice = this.searchText.slice(dateRange.innerStart, dateRange.innerEnd);
        this.datePickerLocalValue = dateArgumentSliceToDatetimeLocal(argSlice);
      } else {
        this.datePickerLocalValue = '';
      }

      if (this.autocompleteTrie) {
        this.autocompleteSuggestions = getAutocompleteSuggestions(
          this.autocompleteTrie,
          this.searchText,
          cursorPos,
          this.schemaPaths
        );
        this.autocompleteIndex = 0;
      } else {
        this.autocompleteSuggestions = [];
      }
    },
    applyDateFromPicker(localDateTime) {
      if (!localDateTime || !this.datePickerContext) {
        return;
      }
      const iso = new Date(localDateTime).toISOString();
      const result = insertQuotedIsoInDateArgument(
        this.searchText,
        this.datePickerContext,
        iso
      );
      const input = this.$refs.searchInput;
      this.searchText = result.text;
      this.autocompleteSuggestions = [];
      this.$nextTick(() => {
        if (input) {
          input.focus();
          input.setSelectionRange(result.newCursorPos, result.newCursorPos);
        }
        this.updateAutocomplete();
      });
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

      const result = applySuggestion(this.searchText, cursorPos, suggestion);
      if (!result) {
        return;
      }

      this.searchText = result.text;
      this.$nextTick(() => {
        input.setSelectionRange(result.newCursorPos, result.newCursorPos);
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
