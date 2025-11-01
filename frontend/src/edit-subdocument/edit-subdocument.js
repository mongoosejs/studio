'use strict';

const template = require('./edit-subdocument.html');

const { BSON, EJSON } = require('bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

module.exports = app => app.component('edit-subdocument', {
  template: template,
  props: {
    value: {
      type: [String, Number, Boolean, Object, Array, Date],
      default: null
    },
    schemaPath: {
      type: Object,
      default: null
    },
    schemaPaths: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      currentValue: null,
      status: 'init',
      hintWidget: null,
      hintSuggestions: [],
      hintIndex: 0,
      hintRange: null,
      _schemaPathIndex: null
    };
  },
  mounted() {
    this.currentValue = this.value == null
      ? '' + this.value
      : JSON.stringify(this.value, null, '  ').trim();
    this.$refs.editor.value = this.currentValue;

    const component = this;
    this.editor = CodeMirror.fromTextArea(this.$refs.editor, {
      mode: 'javascript',
      lineNumbers: true,
      extraKeys: {
        'Ctrl-Space': () => component.triggerHint(true),
        'Cmd-Space': () => component.triggerHint(true)
      }
    });

    this._boundChangeHandler = () => {
      this.currentValue = this.editor.getValue();
    };
    this._boundInputHandler = this.onEditorInput.bind(this);
    this._boundKeydownHandler = this.onEditorKeydown.bind(this);
    this._boundHideHints = this.hideHints.bind(this);
    this._boundCursorActivity = this.onCursorActivity.bind(this);

    this.editor.on('change', this._boundChangeHandler);
    this.editor.on('inputRead', this._boundInputHandler);
    this.editor.on('keydown', this._boundKeydownHandler);
    this.editor.on('blur', this._boundHideHints);
    this.editor.on('scroll', this._boundHideHints);
    this.editor.on('cursorActivity', this._boundCursorActivity);

    this.status = 'loaded';
  },
  watch: {
    currentValue() {
      if (this.status === 'init') {
        return;
      }
      try {
        this.$emit('input', eval(`(${this.currentValue})`));
      } catch (err) {
        console.log('Error', err);
        this.$emit('error', err);
      }
    },
    schemaPaths: {
      handler() {
        this._schemaPathIndex = null;
        if (this.hintSuggestions.length) {
          this.triggerHint(true);
        }
      },
      deep: true
    }
  },
  beforeDestroy() {
    if (this.editor) {
      if (this._boundChangeHandler) {
        this.editor.off('change', this._boundChangeHandler);
      }
      if (this._boundInputHandler) {
        this.editor.off('inputRead', this._boundInputHandler);
      }
      if (this._boundKeydownHandler) {
        this.editor.off('keydown', this._boundKeydownHandler);
      }
      if (this._boundHideHints) {
        this.editor.off('blur', this._boundHideHints);
        this.editor.off('scroll', this._boundHideHints);
      }
      if (this._boundCursorActivity) {
        this.editor.off('cursorActivity', this._boundCursorActivity);
      }
      this.editor.toTextArea();
    }
    this.hideHints();
  },
  methods: {
    onEditorInput() {
      this.triggerHint(false);
    },
    onCursorActivity() {
      if (this.hintWidget) {
        this.hideHints();
      }
    },
    onEditorKeydown(cm, event) {
      if (!this.hintWidget) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.hintIndex = (this.hintIndex + 1) % this.hintSuggestions.length;
        this.highlightHint();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.hintIndex = (this.hintIndex + this.hintSuggestions.length - 1) % this.hintSuggestions.length;
        this.highlightHint();
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        this.applyHint(this.hintIndex);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.hideHints();
      }
    },
    triggerHint(force = false) {
      if (!this.isEmbeddedPath()) {
        return;
      }
      const cursor = this.editor.getCursor();
      const token = this.editor.getTokenAt(cursor);
      const context = this.getHintContext(token, cursor);

      if (!context) {
        this.hideHints();
        return;
      }

      const suggestions = this.getMatchingSuggestions(context.prefix, force);
      if (!suggestions.length) {
        this.hideHints();
        return;
      }

      this.showHints(suggestions, context.range);
    },
    getHintContext(token, cursor) {
      if (!token || !token.type || token.type.indexOf('property') === -1) {
        return null;
      }

      let raw = token.string || '';
      const cleaned = raw.replace(/^['"]/, '').replace(/['"]$/, '');
      let fromCh = token.start;
      let toCh = token.end;

      if (raw.startsWith('"') || raw.startsWith("'")) {
        fromCh += 1;
      }
      if (raw.endsWith('"') || raw.endsWith("'")) {
        toCh -= 1;
      }

      if (toCh < fromCh) {
        toCh = fromCh;
      }

      return {
        prefix: cleaned,
        range: {
          from: { line: cursor.line, ch: fromCh },
          to: { line: cursor.line, ch: toCh }
        }
      };
    },
    getMatchingSuggestions(prefix, force) {
      const available = this.getEmbeddedFieldSuggestions();
      if (!available.length) {
        return [];
      }

      const normalized = (prefix || '').toLowerCase();
      const matches = normalized
        ? available.filter(option => option.nameLower.startsWith(normalized))
        : available;

      if (!matches.length) {
        return [];
      }

      if (!normalized && !force) {
        return [];
      }

      return matches;
    },
    showHints(suggestions, range) {
      this.hideHints();

      const list = document.createElement('ul');
      list.className = 'cm-embedded-hints';
      list.style.position = 'absolute';
      list.style.zIndex = '1000';
      list.style.listStyle = 'none';
      list.style.margin = '0';
      list.style.padding = '4px 0';
      list.style.background = '#ffffff';
      list.style.border = '1px solid #cbd5f5';
      list.style.borderRadius = '4px';
      list.style.boxShadow = '0 2px 6px rgba(15, 23, 42, 0.1)';
      list.style.minWidth = '160px';

      suggestions.forEach((suggestion, index) => {
        const item = document.createElement('li');
        item.style.padding = '4px 12px';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';

        const label = document.createElement('span');
        label.textContent = suggestion.name;
        label.style.fontSize = '13px';
        label.style.fontWeight = '600';
        label.style.color = '#0f172a';

        const meta = document.createElement('span');
        meta.textContent = suggestion.type;
        meta.style.fontSize = '11px';
        meta.style.color = '#64748b';

        item.appendChild(label);
        item.appendChild(meta);

        item.addEventListener('mouseenter', () => {
          this.hintIndex = index;
          this.highlightHint();
        });
        item.addEventListener('mousedown', event => {
          event.preventDefault();
          this.applyHint(index);
        });

        list.appendChild(item);
      });

      this.editor.addWidget(range.from, list, false);
      this.hintWidget = list;
      this.hintSuggestions = suggestions;
      this.hintIndex = 0;
      this.hintRange = range;
      this.highlightHint();
    },
    highlightHint() {
      if (!this.hintWidget) {
        return;
      }
      const children = this.hintWidget.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (i === this.hintIndex) {
          child.style.background = '#e0f2fe';
        } else {
          child.style.background = 'transparent';
        }
      }
    },
    applyHint(index) {
      if (!this.hintSuggestions.length || !this.hintRange) {
        return;
      }

      const suggestion = this.hintSuggestions[index];
      if (!suggestion) {
        return;
      }

      this.editor.replaceRange(
        suggestion.name,
        this.hintRange.from,
        this.hintRange.to
      );
      this.hideHints();
      this.editor.focus();
    },
    hideHints() {
      if (this.hintWidget && this.hintWidget.parentNode) {
        this.hintWidget.parentNode.removeChild(this.hintWidget);
      }
      this.hintWidget = null;
      this.hintSuggestions = [];
      this.hintRange = null;
      this.hintIndex = 0;
    },
    isEmbeddedPath() {
      return !!(this.schemaPath && this.schemaPath.instance === 'Embedded');
    },
    getEmbeddedFieldSuggestions() {
      if (!this.isEmbeddedPath()) {
        return [];
      }

      const basePath = this.schemaPath && this.schemaPath.path
        ? this.schemaPath.path
        : '';
      const prefix = basePath ? `${basePath}.` : '';
      const result = [];
      const seen = new Set();
      const index = this.getSchemaPathIndex();

      for (const schemaPath of this.schemaPaths || []) {
        if (!schemaPath || !schemaPath.path || !schemaPath.path.startsWith(prefix)) {
          continue;
        }
        const remainder = schemaPath.path.slice(prefix.length);
        if (!remainder) {
          continue;
        }
        const [segment] = remainder.split('.');
        if (!segment || seen.has(segment)) {
          continue;
        }
        seen.add(segment);
        const directPath = prefix + segment;
        const directSchema = index[directPath];
        const type = (directSchema && directSchema.instance) || schemaPath.instance || 'Mixed';
        result.push({
          name: segment,
          nameLower: segment.toLowerCase(),
          type
        });
      }

      result.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
      return result;
    },
    getSchemaPathIndex() {
      if (this._schemaPathIndex) {
        return this._schemaPathIndex;
      }

      const index = Object.create(null);
      if (Array.isArray(this.schemaPaths)) {
        for (const schemaPath of this.schemaPaths) {
          if (!schemaPath || schemaPath.path == null) {
            continue;
          }
          index[schemaPath.path] = schemaPath;
        }
      }
      this._schemaPathIndex = index;
      return index;
    }
  },
  emits: ['input', 'error']
});
