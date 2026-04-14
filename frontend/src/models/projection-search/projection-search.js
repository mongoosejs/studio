'use strict';

const template = require('./projection-search.html');

function getBraceDepth(text, pos) {
  let depth = 0;
  for (let i = 0; i < pos; i++) {
    const ch = text[i];
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
    }
  }
  return depth;
}

function collectObjectKeysBefore(text, endPos) {
  const before = text.slice(0, endPos);
  const keys = new Set();
  const re = /([a-zA-Z_][\w.]*)\s*:/g;
  let m;
  while ((m = re.exec(before)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

function getProjectionTokenContext(fullText, cursorPos) {
  const before = fullText.slice(0, cursorPos);
  const depth = getBraceDepth(before, before.length);

  if (depth > 0) {
    const m = before.match(/(?:\{|,)\s*([+-]?)([^\s:},]*)$/);
    if (!m) {
      return null;
    }
    const prefix = m[1] || '';
    const raw = m[2] || '';
    const term = raw.trim().toLowerCase();
    if (!term) {
      return null;
    }
    const token = `${prefix}${raw}`;
    const start = cursorPos - token.length;
    const selectedPaths = collectObjectKeysBefore(before, before.length);
    if (raw) {
      selectedPaths.delete(raw.trim());
    }
    return { mode: 'object', prefix, term, start, selectedPaths };
  }

  const tokenMatch = before.match(/(?:^|[,\s])([+-]?)([^\s,]*)$/);
  if (!tokenMatch) {
    return null;
  }
  const prefix = tokenMatch[1] || '';
  const raw = tokenMatch[2] || '';
  const term = raw.trim().toLowerCase();
  if (!term) {
    return null;
  }

  const token = `${prefix}${raw}`;
  const after = fullText.slice(cursorPos);
  const start = cursorPos - token.length;
  const normalizedText = `${fullText.slice(0, start)}${token}${after}`;
  const tokenCandidates = normalizedText.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  const selectedPaths = new Set(tokenCandidates.map(t => t.replace(/^[+-]/, '')).filter(Boolean));
  if (raw) {
    selectedPaths.delete(raw);
  }

  return { mode: 'list', prefix, term, start, selectedPaths };
}

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
      const ctx = getProjectionTokenContext(this.projectionText, cursorPos);
      if (!ctx) {
        this.clearAutocomplete();
        return;
      }

      const { prefix, term, selectedPaths } = ctx;

      this.autocompleteSuggestions = this.schemaPaths
        .map(path => path.path)
        .filter(path => typeof path === 'string' && path.toLowerCase().includes(term) && !selectedPaths.has(path))
        .slice(0, 10)
        .map(path => (ctx.mode === 'object' ? path : `${prefix}${path}`));
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
      const after = this.projectionText.slice(cursorPos);
      const ctx = getProjectionTokenContext(this.projectionText, cursorPos);
      if (!ctx) {
        return;
      }

      const { mode, start } = ctx;
      let replacement;
      if (mode === 'object') {
        const colon = /^\s*:/.test(after) ? '' : ': ';
        replacement = `${suggestion}${colon}`;
      } else {
        const needsSpace = after.length === 0 || !/^[,\s]/.test(after);
        replacement = needsSpace ? `${suggestion} ` : suggestion;
      }

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
