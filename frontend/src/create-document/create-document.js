'use strict';

const api = require('../api');

const { BSON, EJSON } = require('mongodb/lib/bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

const appendCSS = require('../appendCSS');

appendCSS(require('./create-document.css'));

const template = require('./create-document.html');
const mpath = require('mpath');

function idToHexString(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (/^[a-f0-9]{24}$/i.test(t)) {
      return t;
    }
    return t;
  }
  if (typeof value.toHexString === 'function') {
    return value.toHexString();
  }
  if (typeof value === 'object' && value.$oid != null) {
    return String(value.$oid);
  }
  const s = String(value);
  if (/^[a-f0-9]{24}$/i.test(s)) {
    return s;
  }
  return s;
}

/**
 * Flatten path keys from listModels / getDocuments schemaPaths map (including nested subdocs).
 */
function flattenSchemaPathKeys(schemaPathsMap) {
  if (!schemaPathsMap || typeof schemaPathsMap !== 'object') {
    return [];
  }
  const out = [];
  function walkNested(prefix, subSchema) {
    if (!subSchema || typeof subSchema !== 'object') {
      return;
    }
    for (const subKey of Object.keys(subSchema)) {
      const sub = subSchema[subKey];
      const full = `${prefix}.${subKey}`;
      out.push(full);
      if (sub && sub.schema && typeof sub.schema === 'object') {
        walkNested(full, sub.schema);
      }
    }
  }
  for (const key of Object.keys(schemaPathsMap)) {
    const item = schemaPathsMap[key];
    if (!item) {
      continue;
    }
    out.push(key);
    if (item.schema && typeof item.schema === 'object') {
      walkNested(key, item.schema);
    }
  }
  return [...new Set(out)].sort((a, b) => {
    if (a === '_id') {
      return -1;
    }
    if (b === '_id') {
      return 1;
    }
    return a.localeCompare(b);
  });
}

/** Prefix match first, then substring; same idea as filter field pickers. */
function filterPathSuggestions(choices, term, limit = 15) {
  if (!choices || choices.length === 0) {
    return [];
  }
  const t = (term || '').trim().toLowerCase();
  if (!t) {
    return choices.slice(0, limit);
  }
  const pref = choices.filter(p => p.toLowerCase().startsWith(t));
  const rest = choices.filter(p => !p.toLowerCase().startsWith(t) && p.toLowerCase().includes(t));
  return [...pref, ...rest].slice(0, limit);
}

function deepMerge(target, source) {
  if (source == null || typeof source !== 'object' || Array.isArray(source)) {
    return source;
  }
  const out = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = out[key];
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      !(sv instanceof Date) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv) &&
      !(tv instanceof Date)
    ) {
      out[key] = deepMerge(tv, sv);
    } else {
      out[key] = sv;
    }
  }
  return out;
}

module.exports = app => app.component('create-document', {
  props: {
    currentModel: { type: String, required: true },
    paths: { type: Array, required: true },
    modelSchemaPaths: { type: Object, default: () => ({}) }
  },
  template,
  data: function() {
    return {
      documentData: '',
      errors: [],
      aiPrompt: '',
      aiSuggestion: '',
      aiOriginalDocument: '',
      aiOriginalScript: '',
      lastAiTarget: 'document',
      aiStreaming: false,
      aiSuggestionReady: false,
      createModalTab: 'manual',
      pullMappings: [{ refFieldPath: '', sourcePath: '', targetPath: '' }],
      pullPathAutocomplete: {
        rowIndex: null,
        field: null,
        suggestions: [],
        index: 0
      },
      _pullPathBlurTimer: null,
      pulling: false,
      createDraftScript: '',
      createDraftScriptLogs: '',
      runningCreateScript: false
    };
  },
  beforeDestroy() {
    clearTimeout(this._pullPathBlurTimer);
  },
  watch: {
    targetPathChoices() {
      this.pullMappings.forEach(row => this.syncPullRowPathSelections(row));
    }
  },
  computed: {
    refFieldOptions() {
      return (this.paths || []).filter(
        p => p && p.path && p.ref && typeof p.ref === 'string' && p.ref.trim()
      );
    },
    targetPathChoices() {
      const map = this.modelSchemaPaths[this.currentModel];
      if (map && typeof map === 'object' && Object.keys(map).length > 0) {
        return flattenSchemaPathKeys(map);
      }
      return (this.paths || [])
        .map(p => p.path)
        .filter(Boolean)
        .sort((a, b) => {
          if (a === '_id') {
            return -1;
          }
          if (b === '_id') {
            return 1;
          }
          return a.localeCompare(b);
        });
    }
  },
  methods: {
    async requestAiSuggestion(mode) {
      if (this.aiStreaming) {
        return;
      }
      const prompt = this.aiPrompt.trim();
      if (!prompt) {
        return;
      }
      const target = mode === 'script' ? 'script' : 'document';

      this.aiOriginalDocument = this.documentData;
      this.aiOriginalScript = this.createDraftScript || '';
      this.aiSuggestion = '';
      this.aiSuggestionReady = false;
      this.aiStreaming = true;

      try {
        for await (const event of api.Model.streamChatMessage({
          model: this.currentModel,
          content: prompt,
          documentData: this.aiOriginalDocument,
          createDraftScript: target === 'script' ? this.aiOriginalScript : undefined,
          aiTarget: target
        })) {
          if (event?.textPart) {
            this.aiSuggestion += event.textPart;
            if (target === 'script') {
              this.createDraftScript = this.aiSuggestion;
            }
          }
        }
        if (target === 'document') {
          this.$refs.codeEditor.setValue(this.aiSuggestion);
        } else {
          this.createDraftScript = this.aiSuggestion;
        }
        this.lastAiTarget = target;
        this.aiSuggestionReady = true;
      } catch (err) {
        if (target === 'document') {
          this.$refs.codeEditor.setValue(this.aiOriginalDocument);
        } else {
          this.createDraftScript = this.aiOriginalScript;
        }
        this.$toast.error(
          target === 'script'
            ? 'Failed to generate a script suggestion.'
            : 'Failed to generate a document suggestion.'
        );
        throw err;
      } finally {
        this.aiStreaming = false;
      }
    },
    acceptAiSuggestion() {
      this.aiSuggestionReady = false;
      this.aiSuggestion = '';
      this.aiOriginalDocument = '';
      this.aiOriginalScript = '';
    },
    rejectAiSuggestion() {
      if (this.lastAiTarget === 'script') {
        this.createDraftScript = this.aiOriginalScript;
      } else {
        this.$refs.codeEditor.setValue(this.aiOriginalDocument);
      }
      this.aiSuggestionReady = false;
      this.aiSuggestion = '';
      this.aiOriginalDocument = '';
      this.aiOriginalScript = '';
    },
    sourcePathChoices(refFieldPath) {
      const meta = (this.paths || []).find(p => p.path === refFieldPath);
      const modelName = meta && typeof meta.ref === 'string' ? meta.ref.trim() : '';
      if (!modelName) {
        return [];
      }
      const map = this.modelSchemaPaths[modelName];
      if (!map || typeof map !== 'object' || !Object.keys(map).length) {
        return [];
      }
      return flattenSchemaPathKeys(map);
    },
    syncPullRowPathSelections(row) {
      if (!row) {
        return;
      }
      const sources = this.sourcePathChoices(row.refFieldPath);
      row.sourcePath = sources.includes(row.sourcePath) ? row.sourcePath : (sources[0] || '');
      const targets = this.targetPathChoices;
      row.targetPath = targets.includes(row.targetPath) ? row.targetPath : (targets[0] || '');
    },
    pullPathAutocompleteOpen(rowIdx, field) {
      const a = this.pullPathAutocomplete;
      return a.rowIndex === rowIdx && a.field === field && a.suggestions.length > 0;
    },
    refMetaForPath(path) {
      return this.refFieldOptions.find(o => o.path === path);
    },
    updatePullPathSuggestions(rowIdx, field) {
      const row = this.pullMappings[rowIdx];
      if (!row) {
        return;
      }
      let choices = [];
      let term = '';
      if (field === 'ref') {
        choices = this.refFieldOptions.map(o => o.path);
        term = row.refFieldPath || '';
      } else if (field === 'source') {
        choices = this.sourcePathChoices(row.refFieldPath);
        term = row.sourcePath || '';
      } else if (field === 'target') {
        choices = this.targetPathChoices;
        term = row.targetPath || '';
      }
      this.pullPathAutocomplete.rowIndex = rowIdx;
      this.pullPathAutocomplete.field = field;
      this.pullPathAutocomplete.suggestions = filterPathSuggestions(choices, term, 15);
      this.pullPathAutocomplete.index = 0;
    },
    onPullPathFocus(rowIdx, field) {
      clearTimeout(this._pullPathBlurTimer);
      this.pullPathAutocomplete.rowIndex = rowIdx;
      this.pullPathAutocomplete.field = field;
      this.updatePullPathSuggestions(rowIdx, field);
    },
    onPullPathInput(rowIdx, field) {
      this.$nextTick(() => {
        this.updatePullPathSuggestions(rowIdx, field);
      });
    },
    onPullPathBlur() {
      clearTimeout(this._pullPathBlurTimer);
      this._pullPathBlurTimer = setTimeout(() => {
        this.pullPathAutocomplete.rowIndex = null;
        this.pullPathAutocomplete.field = null;
        this.pullPathAutocomplete.suggestions = [];
      }, 150);
    },
    onPullRefFieldBlur(row) {
      const trimmed = (row.refFieldPath || '').trim();
      const valid = this.refFieldOptions.some(o => o.path === trimmed);
      if (valid) {
        row.refFieldPath = trimmed;
        this.syncPullRowPathSelections(row);
      }
      this.onPullPathBlur();
    },
    onPullPathKeydown(ev, rowIdx, field) {
      const ac = this.pullPathAutocomplete;
      if (!ac.suggestions.length || ac.rowIndex !== rowIdx || ac.field !== field) {
        return;
      }
      if (ev.key === 'Tab' || ev.key === 'Enter') {
        ev.preventDefault();
        this.applyPullPathSuggestion(rowIdx, field, ac.suggestions[ac.index]);
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        ac.index = (ac.index + 1) % ac.suggestions.length;
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        ac.index = (ac.index + ac.suggestions.length - 1) % ac.suggestions.length;
      } else if (ev.key === 'Escape') {
        ac.suggestions = [];
      }
    },
    applyPullPathSuggestion(rowIdx, field, suggestion) {
      if (suggestion == null) {
        return;
      }
      const row = this.pullMappings[rowIdx];
      if (!row) {
        return;
      }
      if (field === 'ref') {
        row.refFieldPath = suggestion;
        this.syncPullRowPathSelections(row);
      } else if (field === 'source') {
        row.sourcePath = suggestion;
      } else if (field === 'target') {
        row.targetPath = suggestion;
      }
      this.pullPathAutocomplete.suggestions = [];
    },
    addPullMappingRow() {
      const first = this.refFieldOptions[0];
      const row = {
        refFieldPath: first ? first.path : '',
        sourcePath: '',
        targetPath: ''
      };
      this.pullMappings.push(row);
      this.syncPullRowPathSelections(row);
    },
    removePullMappingRow(index) {
      if (this.pullMappings.length <= 1) {
        return;
      }
      this.pullMappings.splice(index, 1);
    },
    /**
     * Builds pull API payload from mapping rows. Returns { pulls } or { error }.
     * Skips rows missing ref/source/target. Rows with all three must have a valid ref id on the draft.
     */
    buildPullsFromMappings(draft) {
      const pulls = [];
      for (const m of this.pullMappings) {
        const refFieldPath = (m.refFieldPath || '').trim();
        const sourcePath = (m.sourcePath || '').trim();
        const targetPath = (m.targetPath || '').trim();
        if (!refFieldPath || !sourcePath || !targetPath) {
          continue;
        }
        const meta = (this.paths || []).find(p => p.path === refFieldPath);
        const sourceModel = meta && typeof meta.ref === 'string' ? meta.ref.trim() : '';
        if (!sourceModel) {
          return { error: `No model ref for field "${refFieldPath}".` };
        }
        const rawId = mpath.get(refFieldPath, draft);
        const sourceDocumentId = idToHexString(rawId).trim();
        if (!sourceDocumentId || !/^[a-f0-9]{24}$/i.test(sourceDocumentId)) {
          return {
            error: `Set a valid ObjectId on the draft at "${refFieldPath}" before pulling or creating.`
          };
        }
        pulls.push({ sourceModel, sourceDocumentId, sourcePath, targetPath });
      }
      return { pulls };
    },
    async mergePullIntoDraft(draft) {
      if (!this.refFieldOptions.length) {
        return draft;
      }
      const built = this.buildPullsFromMappings(draft);
      if (built.error) {
        throw new Error(built.error);
      }
      if (!built.pulls.length) {
        return draft;
      }
      const { values } = await api.Model.pullDocumentValues({ pulls: built.pulls });
      const pulled = EJSON.deserialize(values);
      return deepMerge(draft, pulled);
    },
    async pullFromDocument() {
      if (!this.refFieldOptions.length) {
        this.$toast.error('This schema has no reference fields to pull from.');
        return;
      }
      let draft;
      try {
        draft = eval(`(${this.documentData})`);
      } catch (e) {
        this.$toast.error('Fix the document in the editor before pulling.');
        throw e;
      }
      const built = this.buildPullsFromMappings(draft);
      if (built.error) {
        this.$toast.error(built.error);
        return;
      }
      if (!built.pulls.length) {
        this.$toast.error('Add at least one row with related field, source path, and target path.');
        return;
      }
      this.pulling = true;
      try {
        const merged = await this.mergePullIntoDraft(draft);
        this.$refs.codeEditor.setValue(JSON.stringify(merged, null, 2));
        this.errors.length = 0;
        this.$toast.success('Pulled values into the draft.');
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Failed to pull values.';
        this.$toast.error(msg);
        throw err;
      } finally {
        this.pulling = false;
      }
    },
    async runCreateDraftScript() {
      if (this.runningCreateScript) {
        return;
      }
      const script = (this.createDraftScript || '').trim();
      if (!script) {
        this.$toast.error('Enter a script to run.');
        return;
      }
      this.runningCreateScript = true;
      this.createDraftScriptLogs = '';
      try {
        const data = EJSON.serialize(eval(`(${this.documentData})`));
        const { draft, logs } = await api.Model.executeCreateDocumentScript({
          model: this.currentModel,
          data,
          script
        });
        this.createDraftScriptLogs = logs || '';
        const deserialized = EJSON.deserialize(draft);
        this.$refs.codeEditor.setValue(JSON.stringify(deserialized, null, 2));
        this.errors.length = 0;
        this.$toast.success('Script applied to the draft.');
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Script failed.';
        this.$toast.error(msg);
        throw err;
      } finally {
        this.runningCreateScript = false;
      }
    },
    async createDocument() {
      let draft;
      try {
        draft = eval(`(${this.documentData})`);
      } catch (e) {
        this.errors = [e.message || String(e)];
        this.$toast.error('Invalid document in the editor. Check the syntax.');
        return;
      }
      try {
        draft = await this.mergePullIntoDraft(draft);
        this.$refs.codeEditor.setValue(JSON.stringify(draft, null, 2));
      } catch (e) {
        const msg = e.message || String(e);
        this.errors = [msg];
        this.$toast.error(msg);
        return;
      }
      const data = EJSON.serialize(draft);
      try {
        const { doc } = await api.Model.createDocument({ model: this.currentModel, data });
        this.errors.length = 0;
        this.$toast.success('Document created!');
        this.$emit('close', doc);
      } catch (err) {
        if (err.response?.data?.message) {
          console.log(err.response.data);
          const message = err.response.data.message.split(': ').slice(1).join(': ');
          this.errors = message.split(',').map(error => {
            return error.split(': ').slice(1).join(': ').trim();
          });
        }
        throw err;
      }
    }
  },
  mounted: function() {
    const firstRef = this.refFieldOptions[0];
    if (firstRef) {
      this.pullMappings[0].refFieldPath = firstRef.path;
    }
    this.syncPullRowPathSelections(this.pullMappings[0]);
    const requiredPaths = (this.paths || []).filter(x => x.required);
    const initial = {};
    for (const p of requiredPaths) {
      if (p && p.path) {
        mpath.set(p.path, null, initial);
      }
    }
    this.documentData = JSON.stringify(initial, null, 2);
  }
});
