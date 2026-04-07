'use strict';

const template = require('./projection-search.html');

module.exports = app => app.component('projection-search', {
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
      projectionText: this.value || '',
      autocompleteSuggestions: [],
      autocompleteIndex: 0
    };
  },
  watch: {
    value(val) {
      const nextValue = val || '';
      if (nextValue === this.projectionText) {
        return;
      }
      this.projectionText = nextValue;
      this.clearAutocomplete();
    }
  },
  methods: {
    focusInput() {
      const input = this.$refs.projectionInput;
      if (input && typeof input.focus === 'function') {
        input.focus();
      }
    },
    emitInput() {
      this.$emit('projection-input', this.projectionText);
    },
    initProjection(ev) {
      if (!this.projectionText || !this.projectionText.trim()) {
        this.projectionText = '';
        this.emitInput();
        this.$nextTick(() => {
          if (ev && ev.target) {
            ev.target.setSelectionRange(0, 0);
          }
        });
      }
    },
    handleInput() {
      this.emitInput();
      this.updateAutocomplete();
    },
    updateAutocomplete() {
      const input = this.$refs.projectionInput;
      const cursorPos = input ? input.selectionStart : 0;
      const before = this.projectionText.slice(0, cursorPos);
      const tokenMatch = before.match(/(?:^|[,\s])([+-]?)([^\s,]*)$/);
      if (!tokenMatch) {
        this.clearAutocomplete();
        return;
      }

      const prefix = tokenMatch[1] || '';
      const term = (tokenMatch[2] || '').trim().toLowerCase();
      if (!term) {
        this.clearAutocomplete();
        return;
      }

      const token = `${prefix}${tokenMatch[2] || ''}`;
      const after = this.projectionText.slice(cursorPos);
      const start = cursorPos - token.length;
      const fullText = `${this.projectionText.slice(0, start)}${token}${after}`;
      const tokenCandidates = fullText.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      const selectedPaths = new Set(tokenCandidates.map(t => t.replace(/^[+-]/, '')).filter(Boolean));
      if (tokenMatch[2]) {
        selectedPaths.delete(tokenMatch[2]);
      }

      this.autocompleteSuggestions = this.schemaPaths
        .map(path => path.path)
        .filter(path => typeof path === 'string' && path.toLowerCase().includes(term) && !selectedPaths.has(path))
        .slice(0, 10)
        .map(path => `${prefix}${path}`);
      this.autocompleteIndex = 0;
    },
    handleKeyDown(ev) {
      if (this.autocompleteSuggestions.length > 0) {
        if (ev.key === 'Tab' || ev.key === 'Enter') {
          ev.preventDefault();
          this.applySuggestion(this.autocompleteIndex);
          return;
        }
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          this.autocompleteIndex = (this.autocompleteIndex + 1) % this.autocompleteSuggestions.length;
          return;
        }
        if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          this.autocompleteIndex = (this.autocompleteIndex + this.autocompleteSuggestions.length - 1) %
            this.autocompleteSuggestions.length;
          return;
        }
      }

      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.$emit('apply');
      } else if (ev.key === 'Escape') {
        this.clearAutocomplete();
      }
    },
    applySuggestion(index) {
      const suggestion = this.autocompleteSuggestions[index];
      if (!suggestion) {
        return;
      }
      const input = this.$refs.projectionInput;
      if (!input) {
        return;
      }

      const cursorPos = input.selectionStart;
      const before = this.projectionText.slice(0, cursorPos);
      const after = this.projectionText.slice(cursorPos);
      const tokenMatch = before.match(/(?:^|[,\s])([+-]?)([^\s,]*)$/);
      if (!tokenMatch) {
        return;
      }

      const token = `${tokenMatch[1] || ''}${tokenMatch[2] || ''}`;
      const start = cursorPos - token.length;
      const needsSpace = after.length === 0 || !/^[,\s]/.test(after);
      const replacement = needsSpace ? `${suggestion} ` : suggestion;

      this.projectionText = this.projectionText.slice(0, start) + replacement + after;
      this.emitInput();
      this.$nextTick(() => {
        const newCursorPos = start + replacement.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      });
      this.clearAutocomplete();
    },
    hideAutocomplete() {
      window.setTimeout(() => this.clearAutocomplete(), 100);
    },
    clearAutocomplete() {
      this.autocompleteSuggestions = [];
      this.autocompleteIndex = 0;
    }
  }
});
