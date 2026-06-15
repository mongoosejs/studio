'use strict';

const api = require('../api');
const template = require('./mongoose-sleuth.html');
const mpath = require('mpath');

const limit = 20;
const OUTPUT_TYPE_STORAGE_KEY = 'studio:mongoose-sleuth-output-type';

function normalizeProjectionTokens(trimmed) {
  const rawTokens = trimmed.split(/[,\s]+/).filter(Boolean);
  const tokens = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i];
    if (t === '-' || t === '+') {
      if (i + 1 >= rawTokens.length) {
        return null;
      }
      tokens.push(t + rawTokens[++i]);
    } else {
      tokens.push(t);
    }
  }
  return tokens;
}

function parseProjectionObjectNotation(trimmed, schemaPaths) {
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }
  const body = trimmed.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  const pairRe = /(?:^|,)\s*(?:"([^"]+)"|'([^']+)'|([a-zA-Z_$][\w.$]*))\s*:\s*("[^"]*"|'[^']*'|[^,]+?)\s*(?=,|$)/g;
  const includeKeys = [];
  const excludeKeys = [];
  let matchedChars = '';
  let match;

  while ((match = pairRe.exec(body)) !== null) {
    matchedChars += match[0];
    const key = (match[1] || match[2] || match[3] || '').trim();
    const rawValue = (match[4] || '').trim();
    if (!key || !rawValue) {
      return null;
    }

    const valueLower = rawValue.replace(/^['"]|['"]$/g, '').trim().toLowerCase();
    const isInclude = valueLower === '1' || valueLower === 'true';
    const isExclude = valueLower === '0' || valueLower === 'false';
    if (!isInclude && !isExclude) {
      return null;
    }
    if (isInclude) {
      includeKeys.push(key);
    } else {
      excludeKeys.push(key);
    }
  }

  const normalizedBody = body.replace(/\s+/g, '');
  const normalizedMatched = matchedChars.replace(/\s+/g, '').replace(/^,/, '');
  if (!normalizedMatched || normalizedMatched !== normalizedBody) {
    return null;
  }

  const normalizeKey = (key) => String(key).trim();
  if (includeKeys.length > 0 && excludeKeys.length > 0) {
    const includeSet = new Set(includeKeys.map(normalizeKey));
    for (const path of excludeKeys) {
      const ex = normalizeKey(path);
      for (const k of Array.from(includeSet)) {
        if (k.toLowerCase() === ex.toLowerCase()) {
          includeSet.delete(k);
        }
      }
    }
    if (includeSet.size === 0) {
      return null;
    }
    return Array.from(includeSet);
  }

  if (excludeKeys.length > 0) {
    const excludeNorm = excludeKeys.map(normalizeKey);
    return schemaPaths
      .map(p => p.path)
      .filter(p => !excludeNorm.some(ex => ex === p || p.toLowerCase() === ex.toLowerCase()));
  }

  return includeKeys.map(normalizeKey);
}

function parseProjectionInput(text, schemaPaths) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const normalizeKey = (key) => String(key).trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return parseProjectionObjectNotation(trimmed, schemaPaths);
  }

  const tokens = normalizeProjectionTokens(trimmed);
  if (tokens === null) {
    return null;
  }
  if (tokens.length === 0) {
    return [];
  }

  const includeKeys = [];
  const excludeKeys = [];

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) {
      continue;
    }

    const prefix = token[0];
    if (prefix === '-') {
      const path = token.slice(1).trim();
      if (!path) {
        return null;
      }
      excludeKeys.push(path);
    } else if (prefix === '+') {
      const path = token.slice(1).trim();
      if (!path) {
        return null;
      }
      includeKeys.push(path);
    } else {
      includeKeys.push(token);
    }
  }

  if (includeKeys.length > 0 && excludeKeys.length > 0) {
    const includeSet = new Set(includeKeys.map(normalizeKey));
    for (const path of excludeKeys) {
      const ex = normalizeKey(path);
      for (const k of Array.from(includeSet)) {
        if (k.toLowerCase() === ex.toLowerCase()) {
          includeSet.delete(k);
        }
      }
    }
    if (includeSet.size === 0) {
      return null;
    }
    return Array.from(includeSet);
  }

  if (excludeKeys.length > 0) {
    const excludeNorm = excludeKeys.map(normalizeKey);
    return schemaPaths
      .map(p => p.path)
      .filter(p => !excludeNorm.some(ex => ex === p || p.toLowerCase() === ex.toLowerCase()));
  }

  return includeKeys.map(normalizeKey);
}

function projectionExplicitlyExcludesId(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const body = trimmed.slice(1, -1).trim();
    if (!body) {
      return false;
    }
    const pairRe = /(?:^|,)\s*(?:"([^"]+)"|'([^']+)'|([a-zA-Z_$][\w.$]*))\s*:\s*("[^"]*"|'[^']*'|[^,]+?)\s*(?=,|$)/g;
    let match;
    while ((match = pairRe.exec(body)) !== null) {
      const key = (match[1] || match[2] || match[3] || '').trim();
      if (!key || key.toLowerCase() !== '_id') {
        continue;
      }
      const rawValue = (match[4] || '').trim();
      const valueLower = rawValue.replace(/^['"]|['"]$/g, '').trim().toLowerCase();
      if (valueLower === '0' || valueLower === 'false') {
        return true;
      }
    }
    return false;
  }

  const tokens = normalizeProjectionTokens(trimmed);
  if (!tokens) {
    return false;
  }
  return tokens.some((rawToken) => {
    const token = rawToken.trim();
    return token.toLowerCase() === '-_id';
  });
}

// Models view is mounted with router-view :key="$route.fullPath", so changing models
// remounts the parent and destroys this component. Keep working Sleuth state in
// memory so the case report / selection survives model switches.
const embeddedModelsSleuthState = {
  selectedDocuments: [],
  documentNotes: {},
  currentCaseReportId: null,
  currentCaseReportName: '',
  summary: '',
  aiSummary: '',
  identifierPathByModel: {},
  projectionTextByModel: {}
};

function persistEmbeddedModelsSleuthState(vm) {
  if (!vm.sourceModel) {
    return;
  }
  const s = embeddedModelsSleuthState;
  s.selectedDocuments = Array.isArray(vm.selectedDocuments) ? vm.selectedDocuments.slice() : [];
  s.documentNotes = { ...vm.documentNotes };
  s.currentCaseReportId = vm.currentCaseReportId;
  s.currentCaseReportName = vm.currentCaseReportName;
  s.summary = typeof vm.summary === 'string' ? vm.summary : '';
  s.aiSummary = typeof vm.aiSummary === 'string' ? vm.aiSummary : '';
  s.identifierPathByModel = vm.identifierPathByModel && typeof vm.identifierPathByModel === 'object'
    ? { ...vm.identifierPathByModel }
    : {};
  s.projectionTextByModel = vm.projectionTextByModel && typeof vm.projectionTextByModel === 'object'
    ? { ...vm.projectionTextByModel }
    : {};
}

function pathsObjectToSortedArray(pathsObj) {
  if (!pathsObj || typeof pathsObj !== 'object') {
    return [];
  }
  return Object.values(pathsObj).sort((a, b) => {
    const pa = (a && a.path) || '';
    const pb = (b && b.path) || '';
    if (pa === '_id' && pb !== '_id') {
      return -1;
    }
    if (pa !== '_id' && pb === '_id') {
      return 1;
    }
    return pa.localeCompare(pb);
  });
}

function hydrateEmbeddedModelsSleuthState(vm) {
  if (!vm.sourceModel) {
    return;
  }
  const s = embeddedModelsSleuthState;
  vm.selectedDocuments = s.selectedDocuments.length > 0 ? s.selectedDocuments.slice() : [];
  vm.documentNotes = { ...s.documentNotes };
  vm.currentCaseReportId = s.currentCaseReportId;
  vm.currentCaseReportName = s.currentCaseReportName || '';
  vm.summary = s.summary || '';
  vm.aiSummary = s.aiSummary || '';
  vm.identifierPathByModel = s.identifierPathByModel && typeof s.identifierPathByModel === 'object'
    ? { ...s.identifierPathByModel }
    : {};
  vm.projectionTextByModel = s.projectionTextByModel && typeof s.projectionTextByModel === 'object'
    ? { ...s.projectionTextByModel }
    : {};
  vm.investigationDocPreviewExpanded = {};
  vm.shouldShowCaseReportModal = false;
  vm.caseReportName = '';
}

module.exports = app => app.component('mongoose-sleuth', {
  template: template,
  props: {
    sourceModel: { type: String, default: null },
    sourceDocuments: { type: Array, default: null },
    sourceNumDocuments: { type: Number, default: null },
    sourceSchemaPaths: { type: Array, default: null },
    sourceFilteredPaths: { type: Array, default: null },
    sourceSelectedDocuments: { type: Array, default: null }
  },
  provide() {
    return {
      sleuthContext: this
    };
  },
  data: () => ({
    models: [],
    currentModel: null,
    documents: [],
    schemaPaths: [],
    filteredPaths: [],
    numDocuments: null,
    status: 'loading',
    loadedAllDocs: false,
    searchText: '',
    sortBy: {},
    query: {},
    scrollHeight: 0,
    outputType: 'json', // json, table
    hideSidebar: null,
    selectedDocuments: [],
    error: null,
    shouldShowCaseReportModal: false,
    caseReportName: '',
    currentCaseReportId: null,
    documentNotes: {},
    summary: '',
    aiSummary: '',
    savingSummary: false,
    /** Prevents overlapping deferred AI runs when route updates fire more than once. */
    deferredAISummaryInProgress: false,
    loadingCaseReport: false,
    caseReports: [],
    currentCaseReportName: '',
    // Mongoose schema paths keyed by model name (from getDocument / document stream)
    schemaPathsByModel: {},
    // Step 2: per-model Mongoose path (e.g. "email", "profile.name") used as human label
    identifierPathByModel: {},
    // Step 2: per-model projection string for document previews
    projectionTextByModel: {},
    // Step 2: getDocumentKey -> show embedded JSON preview
    investigationDocPreviewExpanded: {},
    // Case report timeline: highlighted document card
    focusedInvestigationDocumentKey: null
  }),
  created() {
    this.loadOutputPreference();
  },
  beforeDestroy() {
    const container = this.getBrowseScrollContainer();
    if (container) {
      container.removeEventListener('scroll', this.onScroll, true);
    }
    persistEmbeddedModelsSleuthState(this);
  },
  async mounted() {
    hydrateEmbeddedModelsSleuthState(this);
    this.onScroll = () => this.checkIfScrolledToBottom();
    this.attachScrollListener();
    const { models, readyState } = await api.Model.listModels();
    this.models = models;
    if (this.models.length === 0) {
      this.status = 'loaded';
      if (readyState === 0) {
        this.error = 'No models found and Mongoose is not connected. Check our documentation for more information.';
      }
    } else {
      this.status = 'loaded';
    }

    // Load case reports for "use existing" dropdown
    try {
      const { caseReports } = await api.CaseReport.getCaseReports();
      this.caseReports = Array.isArray(caseReports) ? caseReports : [];
    } catch (err) {
      // Non-fatal; just log
      console.error('Error loading case reports for Sleuth sidebar', err);
    }

    // If opened with an existing case report (from route params on case-report page or query when embedded), load it and go to Step 2
    const caseReportId = this.$route?.params?.caseReportId || this.$route?.query?.caseReportId;
    if (caseReportId) {
      this.currentCaseReportId = caseReportId;
      try {
        await this.loadCaseReport(caseReportId);
      } catch (err) {
        console.error('Error loading case report', err);
        this.$toast.error(`Error loading case report: ${err?.message || 'Unknown error'}`);
      }
    }

    // Add document from document view if user clicked "Add to Sleuth"
    if (this.hasSourceFromModelsView || this.$route?.name === 'case-report') {
      await this.applyPendingAddFromDocumentView();
    }

    await this.maybeRunPendingAISummary();
  },
  watch: {
    sourceModel: {
      handler(val) {
        if (this.hasSourceFromModelsView && val) {
          this.currentModel = val;
        }
      },
      immediate: true
    },
    '$route.params.caseReportId': {
      async handler(caseReportId) {
        if (!caseReportId) return;
        this.currentCaseReportId = caseReportId;
        try {
          await this.loadCaseReport(caseReportId);
        } catch (err) {
          console.error('Error loading case report', err);
          this.$toast.error(`Error loading case report: ${err?.message || 'Unknown error'}`);
        }
      }
    },
    selectedDocuments: {
      deep: true,
      handler() {
        const modelsInUse = new Set(
          this.selectedDocuments.map(d => d && d.model != null && String(d.model)).filter(Boolean)
        );
        const nextIds = {};
        for (const m of Object.keys(this.identifierPathByModel)) {
          if (modelsInUse.has(m)) {
            nextIds[m] = this.identifierPathByModel[m];
          }
        }
        this.identifierPathByModel = nextIds;
        const validKeys = new Set(
          this.selectedDocuments.map(d => this.getDocumentKey(d)).filter(Boolean)
        );
        const nextPeek = {};
        for (const k of Object.keys(this.investigationDocPreviewExpanded)) {
          if (validKeys.has(k)) {
            nextPeek[k] = this.investigationDocPreviewExpanded[k];
          }
        }
        this.investigationDocPreviewExpanded = nextPeek;
        if (
          this.focusedInvestigationDocumentKey &&
          !validKeys.has(this.focusedInvestigationDocumentKey)
        ) {
          this.focusedInvestigationDocumentKey = null;
        }
      }
    }
  },
  updated() {
    this.$nextTick(() => this.attachScrollListener());
  },
  computed: {
    hasSourceFromModelsView() {
      return this.sourceModel != null && this.sourceModel !== '';
    },
    displayModel() {
      return this.hasSourceFromModelsView ? this.sourceModel : this.currentModel;
    },
    displayDocuments() {
      if (this.hasSourceFromModelsView && Array.isArray(this.sourceDocuments)) {
        return this.sourceDocuments;
      }
      return this.documents;
    },
    displayNumDocuments() {
      if (this.hasSourceFromModelsView && typeof this.sourceNumDocuments === 'number') {
        return this.sourceNumDocuments;
      }
      return this.numDocuments;
    },
    displaySchemaPaths() {
      if (this.hasSourceFromModelsView && Array.isArray(this.sourceSchemaPaths) && this.sourceSchemaPaths.length > 0) {
        return this.sourceSchemaPaths;
      }
      return this.schemaPaths;
    },
    displayFilteredPaths() {
      if (this.hasSourceFromModelsView && Array.isArray(this.sourceFilteredPaths) && this.sourceFilteredPaths.length > 0) {
        return this.sourceFilteredPaths;
      }
      return this.filteredPaths;
    },
    browseTablePaths() {
      const paths = this.displayFilteredPaths;
      if (Array.isArray(paths) && paths.length > 0) {
        return paths;
      }
      return this.displaySchemaPaths;
    },
    referenceMap() {
      const map = {};
      for (const path of this.displayFilteredPaths) {
        if (path?.ref) {
          map[path.path] = path.ref;
        }
      }
      return map;
    },
    selectedDocumentsByModel() {
      const grouped = {};
      for (const doc of this.selectedDocuments) {
        if (!doc) {
          continue;
        }
        const model = doc.model != null && doc.model !== '' ? String(doc.model) : '';
        if (!grouped[model]) {
          grouped[model] = [];
        }
        grouped[model].push(doc);
      }
      return Object.keys(grouped).sort().map(model => ({
        model: model || 'Unknown model',
        documents: grouped[model]
      }));
    },
    availableCaseReports() {
      if (!Array.isArray(this.caseReports)) {
        return [];
      }
      return this.caseReports.filter(cr => cr);
    },
    investigationModelNames() {
      const set = new Set();
      for (const doc of this.selectedDocuments) {
        if (doc && doc.model) {
          set.add(String(doc.model));
        }
      }
      return Array.from(set).sort();
    },
    isCaseReportDetailRoute() {
      return this.$route && this.$route.name === 'case-report';
    }
  },
  methods: {
    async selectExistingCaseReport(caseReportId) {
      if (!caseReportId) {
        return;
      }
      this.currentCaseReportId = caseReportId;
      try {
        await this.loadCaseReport(caseReportId);
      } catch (err) {
        console.error('Error loading existing case report from Sleuth select', err);
        this.$toast?.error?.(err?.message || 'Error loading case report');
      }
    },
    attachScrollListener() {
      const container = this.getBrowseScrollContainer();
      if (container) {
        container.removeEventListener('scroll', this.onScroll, true);
        container.addEventListener('scroll', this.onScroll, true);
      }
    },
    getBrowseScrollContainer() {
      const listRef = this.$refs.unified?.$refs?.documentsList;
      if (!listRef) {
        return null;
      }
      if (listRef.classList && listRef.classList.contains('documents-container')) {
        return listRef;
      }
      return listRef.querySelector('.documents-container');
    },
    async persistCaseReportDocuments(options = {}) {
      if (!this.currentCaseReportId) {
        return false;
      }
      const documentsPayload = this.buildDocumentsPayload();
      try {
        await api.CaseReport.updateCaseReport({
          caseReportId: this.currentCaseReportId,
          documents: documentsPayload
        });
        if (options.toast !== false) {
          this.$toast.success(options.toastMessage || 'Case report updated');
        }
        return true;
      } catch (err) {
        console.error('Error updating case report documents', err);
        this.$toast.error(err?.message || 'Error updating case report');
        return false;
      }
    },
    buildDocumentsPayload() {
      return this.selectedDocuments.map(doc => {
        const rawId = doc._id;
        const documentId = rawId == null
          ? undefined
          : (Array.isArray(rawId) ? rawId[0] : rawId);
        const idStr = documentId != null && typeof documentId === 'object' && typeof documentId.toString === 'function'
          ? documentId.toString()
          : documentId != null ? String(documentId) : undefined;
        const base = {
          documentId: idStr,
          documentModel: doc.model
        };
        const note = this.getDocumentNote(doc);
        if (note && note.trim()) {
          base.notes = note.trim();
        }
        const model = doc.model != null ? String(doc.model) : '';
        const projectionPaths = model ? this.getProjectionFilteredPathsForModel(model) : null;
        if (projectionPaths && projectionPaths.length > 0) {
          base.highlightedFields = projectionPaths;
        } else if (doc.highlightedFields && doc.highlightedFields.length > 0) {
          base.highlightedFields = doc.highlightedFields;
        }
        return base;
      });
    },
    loadOutputPreference() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      const storedPreference = window.localStorage.getItem(OUTPUT_TYPE_STORAGE_KEY);
      if (storedPreference === 'json' || storedPreference === 'table') {
        this.outputType = storedPreference;
      }
    },
    setOutputType(type) {
      if (type !== 'json' && type !== 'table') {
        return;
      }
      this.outputType = type;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(OUTPUT_TYPE_STORAGE_KEY, type);
      }
    },
    buildDocumentFetchParams(options = {}) {
      const params = {
        model: this.currentModel,
        limit
      };

      if (typeof options.skip === 'number') {
        params.skip = options.skip;
      }

      const sortKeys = Object.keys(this.sortBy);
      if (sortKeys.length > 0) {
        const key = sortKeys[0];
        if (typeof key === 'string' && key.length > 0) {
          params.sortKey = key;
          const direction = this.sortBy[key];
          if (direction !== undefined && direction !== null) {
            params.sortDirection = direction;
          }
        }
      }

      if (typeof this.searchText === 'string' && this.searchText.trim().length > 0) {
        params.searchText = this.searchText;
      }

      const projectionInput = this.getProjectionTextForModel(this.currentModel);
      if (typeof projectionInput === 'string' && projectionInput.trim().length > 0) {
        params.projectionInput = projectionInput.trim();
      } else if (this.filteredPaths.length > 0) {
        const fieldPaths = this.filteredPaths.map(p => p.path).filter(Boolean);
        if (fieldPaths.length > 0) {
          params.projectionInput = fieldPaths.join(' ');
        }
      }

      return params;
    },
    syncFilteredPathsFromBrowseProjection() {
      if (!this.currentModel || !Array.isArray(this.schemaPaths) || this.schemaPaths.length === 0) {
        return;
      }
      const text = this.getProjectionTextForModel(this.currentModel);
      if (!text || !text.trim()) {
        this.filteredPaths = [...this.schemaPaths];
        return;
      }
      const paths = this.normalizeProjectionPathsForModel(this.currentModel, text);
      if (paths == null) {
        return;
      }
      if (paths.length === 0) {
        this.filteredPaths = this.schemaPaths.filter(p => p.path === '_id');
        if (this.filteredPaths.length === 0 && this.schemaPaths.length > 0) {
          const idPath = this.schemaPaths.find(p => p.path === '_id');
          this.filteredPaths = idPath ? [idPath] : [this.schemaPaths[0]];
        }
        return;
      }
      this.filteredPaths = paths
        .map(path => this.schemaPaths.find(p => p.path === path))
        .filter(Boolean);
      const validPaths = new Set(this.schemaPaths.map(p => p.path));
      for (const path of paths) {
        if (validPaths.has(path) && !this.filteredPaths.find(p => p.path === path)) {
          this.filteredPaths.push(this.schemaPaths.find(p => p.path === path));
        }
      }
      if (this.filteredPaths.length === 0) {
        this.filteredPaths = this.schemaPaths.filter(p => p.path === '_id');
      }
    },
    async applyBrowseProjection() {
      if (!this.currentModel) {
        return;
      }
      this.syncFilteredPathsFromBrowseProjection();
      this.status = 'loading';
      this.error = null;
      try {
        await this.getDocuments();
        this.status = 'loaded';
        this.$nextTick(() => this.attachScrollListener());
      } catch (err) {
        this.error = err?.message || 'Error loading documents';
        this.status = 'loaded';
      }
    },
    async selectModel(model) {
      this.currentModel = model;
      this.documents = [];
      this.schemaPaths = [];
      this.filteredPaths = [];
      this.numDocuments = null;
      this.loadedAllDocs = false;
      this.searchText = '';
      this.status = 'loading';
      this.error = null;
      await this.getDocuments();
      this.status = 'loaded';
      this.$nextTick(() => this.attachScrollListener());
    },
    formatDocumentId(raw) {
      if (raw == null) {
        return '';
      }
      if (typeof raw === 'object' && raw.$oid != null) {
        return String(raw.$oid);
      }
      if (typeof raw.toString === 'function') {
        return raw.toString();
      }
      return String(raw);
    },
    getDocumentKey(doc) {
      if (!doc || doc._id == null || !doc.model) {
        return '';
      }
      return `${String(doc.model)}:${this.formatDocumentId(doc._id)}`;
    },
    getDocumentLabel(doc) {
      if (!doc) {
        return '';
      }
      const idStr = this.formatDocumentId(doc._id);
      const modelStr = doc.model != null ? String(doc.model) : '';
      const preview = this.getDocumentPreview(doc);
      if (preview && idStr) {
        return `${modelStr ? modelStr + ' · ' : ''}${preview} (${idStr})`;
      }
      if (modelStr && idStr) {
        return `${modelStr} · ${idStr}`;
      }
      return idStr || 'Document';
    },
    getBrowseDocumentLabel(doc) {
      if (!doc || !this.currentModel) {
        return this.getDocumentLabel(doc);
      }
      return this.getDocumentLabel({ ...doc, model: this.currentModel });
    },
    formatFieldValueForLabel(val) {
      if (val == null) {
        return '';
      }
      if (typeof val === 'string') {
        return val.length > 120 ? `${val.slice(0, 117)}…` : val;
      }
      if (typeof val === 'number' || typeof val === 'boolean') {
        return String(val);
      }
      if (val instanceof Date) {
        return val.toISOString();
      }
      if (typeof val === 'object' && val.$oid != null) {
        return String(val.$oid);
      }
      if (typeof val === 'object' && typeof val.toString === 'function' && !Array.isArray(val)) {
        const t = val.toString();
        if (t && t !== '[object Object]') {
          return t.length > 80 ? `${t.slice(0, 77)}…` : t;
        }
      }
      if (Array.isArray(val)) {
        return `(${val.length} items)`;
      }
      return '';
    },
    getInvestigationDocumentLabel(doc) {
      if (!doc) {
        return '';
      }
      const model = doc.model != null ? String(doc.model) : '';
      const path = model && this.identifierPathByModel[model];
      if (path) {
        try {
          const v = mpath.get(path, doc);
          const s = this.formatFieldValueForLabel(v);
          if (s) {
            return s;
          }
        } catch (err) {
          // ignore bad path
        }
      }
      return this.getDocumentPreview(doc);
    },
    getInvestigationDocumentHeading(doc) {
      if (!doc) {
        return '';
      }
      const idStr = this.formatDocumentId(doc._id);
      const modelStr = doc.model != null ? String(doc.model) : '';
      const label = this.getInvestigationDocumentLabel(doc);
      if (label && idStr) {
        return `${modelStr ? `${modelStr} · ` : ''}${label} (${idStr})`;
      }
      if (modelStr && idStr) {
        return `${modelStr} · ${idStr}`;
      }
      return idStr || 'Document';
    },
    setIdentifierPathForModel(model, path) {
      if (!model) {
        return;
      }
      const next = { ...this.identifierPathByModel };
      if (!path) {
        delete next[model];
      } else {
        next[model] = path;
      }
      this.identifierPathByModel = next;
    },
    getProjectionTextForModel(model) {
      if (!model) {
        return '';
      }
      return this.projectionTextByModel[model] || '';
    },
    setProjectionTextForModel(model, text) {
      if (!model) {
        return;
      }
      const next = { ...this.projectionTextByModel };
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) {
        delete next[model];
      } else {
        next[model] = text;
      }
      this.projectionTextByModel = next;
    },
    clearProjectionForModel(model) {
      if (!model) {
        return;
      }
      const next = { ...this.projectionTextByModel };
      delete next[model];
      this.projectionTextByModel = next;
    },
    getProjectionSchemaPathsForModel(model) {
      return this.getSchemaPathsArrayForModel(model);
    },
    getSchemaPathsArrayForModel(model) {
      if (!model) {
        return [];
      }
      const cached = this.schemaPathsByModel[model];
      if (cached && typeof cached === 'object') {
        return pathsObjectToSortedArray(cached);
      }
      const sample = this.selectedDocuments.find(d => d && d.model === model);
      if (sample) {
        return this.inferSchemaPathsFromDocument(sample);
      }
      return [];
    },
    normalizeProjectionPathsForModel(model, text) {
      const schemaPaths = this.getSchemaPathsArrayForModel(model);
      const paths = parseProjectionInput(text, schemaPaths);
      if (paths == null) {
        return null;
      }
      const excludesId = projectionExplicitlyExcludesId(text);
      const hasIdSchemaPath = schemaPaths.some(p => p.path === '_id');
      if (hasIdSchemaPath && !excludesId) {
        const hasIdAlready = paths.some(p => String(p).toLowerCase() === '_id');
        if (!hasIdAlready) {
          paths.unshift('_id');
        }
      }
      return paths;
    },
    getProjectionFilteredPathsForModel(model) {
      const text = this.getProjectionTextForModel(model);
      if (!text || !text.trim()) {
        return null;
      }
      return this.normalizeProjectionPathsForModel(model, text);
    },
    getEffectiveProjectionPathsForDocument(doc) {
      if (!doc) {
        return null;
      }
      const model = doc.model != null ? String(doc.model) : '';
      const fromProjection = model ? this.getProjectionFilteredPathsForModel(model) : null;
      if (fromProjection && fromProjection.length > 0) {
        return fromProjection;
      }
      if (
        this.hasSourceFromModelsView &&
        model &&
        model === this.displayModel &&
        Array.isArray(this.sourceFilteredPaths) &&
        this.sourceFilteredPaths.length > 0
      ) {
        return this.sourceFilteredPaths.map(p => p.path).filter(Boolean);
      }
      if (Array.isArray(doc.highlightedFields) && doc.highlightedFields.length > 0) {
        return doc.highlightedFields.slice();
      }
      return null;
    },
    seedProjectionTextFromHighlightedFields(docs) {
      if (!Array.isArray(docs) || docs.length === 0) {
        return;
      }
      const next = { ...this.projectionTextByModel };
      const byModel = {};
      for (const doc of docs) {
        if (!doc || !doc.model) {
          continue;
        }
        const model = String(doc.model);
        if (next[model] || byModel[model]) {
          continue;
        }
        if (Array.isArray(doc.highlightedFields) && doc.highlightedFields.length > 0) {
          byModel[model] = doc.highlightedFields.join(' ');
        }
      }
      for (const [model, text] of Object.entries(byModel)) {
        next[model] = text;
      }
      this.projectionTextByModel = next;
    },
    filterInvestigationDocument(doc) {
      if (!doc) {
        return doc;
      }
      const filteredPaths = this.getEffectiveProjectionPathsForDocument(doc);
      if (!filteredPaths || filteredPaths.length === 0) {
        return doc;
      }
      const filteredDoc = {};
      for (let i = 0; i < filteredPaths.length; i++) {
        const path = filteredPaths[i];
        const value = mpath.get(path, doc);
        mpath.set(path, value, filteredDoc, function(cur, pathPart, val) {
          if (arguments.length === 2) {
            if (cur[pathPart] == null) {
              cur[pathPart] = {};
            }
            return cur[pathPart];
          }
          cur[pathPart] = val;
          return val;
        });
      }
      return filteredDoc;
    },
    getInvestigationTablePaths(doc) {
      if (!doc) {
        return [];
      }
      const model = doc.model != null ? String(doc.model) : '';
      if (
        this.hasSourceFromModelsView &&
        model &&
        model === this.displayModel &&
        Array.isArray(this.sourceFilteredPaths) &&
        this.sourceFilteredPaths.length > 0
      ) {
        return this.sourceFilteredPaths;
      }
      let schemaPaths = this.getSchemaPathsArrayForModel(model);
      if (!schemaPaths || schemaPaths.length === 0) {
        schemaPaths = this.inferSchemaPathsFromDocument(doc);
      }
      const pathStrings = this.getEffectiveProjectionPathsForDocument(doc);
      if (!pathStrings || pathStrings.length === 0) {
        return schemaPaths;
      }
      const byPath = new Map(schemaPaths.map(p => [p.path, p]));
      return pathStrings
        .map(path => byPath.get(path) || { path, instance: 'Mixed' })
        .filter(p => p && p.path);
    },
    getInvestigationReferenceMap(doc) {
      const map = {};
      for (const path of this.getInvestigationTablePaths(doc)) {
        if (path?.ref) {
          map[path.path] = path.ref;
        }
      }
      return map;
    },
    getIdentifierFieldOptions(model) {
      if (!model) {
        return [];
      }
      let paths = [];
      const cached = this.schemaPathsByModel[model];
      if (cached && typeof cached === 'object') {
        paths = pathsObjectToSortedArray(cached);
      } else {
        const sample = this.selectedDocuments.find(d => d && d.model === model);
        if (sample) {
          paths = this.inferSchemaPathsFromDocument(sample);
        }
      }
      const allowed = new Set(['String', 'Number', 'Boolean', 'Date', 'ObjectId', 'Mixed', 'UUID']);
      const out = [];
      const seen = new Set();
      for (const p of paths) {
        if (!p || !p.path || seen.has(p.path)) {
          continue;
        }
        const inst = p.instance || 'Mixed';
        if (!allowed.has(inst)) {
          continue;
        }
        seen.add(p.path);
        out.push({ path: p.path, instance: inst });
        if (out.length >= 250) {
          break;
        }
      }
      return out;
    },
    getTimelineShortLabel(doc) {
      if (!doc) {
        return 'Document';
      }
      const label = this.getInvestigationDocumentLabel(doc);
      if (label) {
        return label.length > 28 ? `${label.slice(0, 28)}…` : label;
      }
      const idStr = this.formatDocumentId(doc._id);
      return idStr && idStr.length > 12 ? `${idStr.slice(0, 12)}…` : (idStr || 'Document');
    },
    reorderSelectedDocuments(fromIndex, toIndex) {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
        return;
      }
      const docs = this.selectedDocuments.slice();
      if (fromIndex >= docs.length || toIndex >= docs.length) {
        return;
      }
      const [item] = docs.splice(fromIndex, 1);
      docs.splice(toIndex, 0, item);
      this.selectedDocuments = docs;
    },
    focusInvestigationDocument(doc) {
      const key = this.getDocumentKey(doc);
      if (!key) {
        return;
      }
      this.focusedInvestigationDocumentKey = key;
      const next = { ...this.investigationDocPreviewExpanded };
      delete next[key];
      this.investigationDocPreviewExpanded = next;
    },
    isInvestigationDocumentFocused(doc) {
      const key = this.getDocumentKey(doc);
      return !!key && this.focusedInvestigationDocumentKey === key;
    },
    documentHref(doc) {
      if (!doc || doc._id == null || !doc.model) {
        return '#';
      }
      const m = encodeURIComponent(String(doc.model));
      const id = encodeURIComponent(this.formatDocumentId(doc._id));
      return `#/model/${m}/document/${id}`;
    },
    toggleInvestigationDocPreview(doc) {
      const key = this.getDocumentKey(doc);
      if (!key) {
        return;
      }
      const next = { ...this.investigationDocPreviewExpanded };
      const isOpen = !Object.prototype.hasOwnProperty.call(next, key) || !!next[key];
      if (isOpen) {
        next[key] = false;
      } else {
        delete next[key];
      }
      this.investigationDocPreviewExpanded = next;
    },
    isInvestigationDocPreviewOpen(doc) {
      const key = this.getDocumentKey(doc);
      if (!key) {
        return true;
      }
      if (!Object.prototype.hasOwnProperty.call(this.investigationDocPreviewExpanded, key)) {
        return true;
      }
      return !!this.investigationDocPreviewExpanded[key];
    },
    getDocumentPreview(doc) {
      if (!doc || typeof doc !== 'object') {
        return '';
      }
      // Try common fields that might be useful for identification
      const previewFields = ['name', 'title', 'email', 'username', 'label', 'description', 'slug', 'subject', 'key', 'displayName'];
      for (const field of previewFields) {
        if (doc[field] != null) {
          const value = doc[field];
          if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
          }
          if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
          }
        }
      }
      // If no preview field found, return empty string
      return '';
    },
    isSleuthLeafBSON(val) {
      if (val == null || typeof val !== 'object') {
        return true;
      }
      if (val instanceof Date) {
        return true;
      }
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(val)) {
        return true;
      }
      const ctor = val.constructor;
      if (ctor && (ctor.name === 'ObjectId' || ctor.name === 'Decimal128' || ctor.name === 'UUID')) {
        return true;
      }
      const keys = Object.keys(val);
      if (keys.length === 1 && val.$oid != null) {
        return true;
      }
      return false;
    },
    inferSchemaPathsFromDocument(doc) {
      const pathMap = new Map();
      const maxDepth = 12;
      const instanceForLeaf = val => {
        if (val == null) {
          return 'Mixed';
        }
        if (Array.isArray(val)) {
          return 'Array';
        }
        if (typeof val === 'string') {
          return 'String';
        }
        if (typeof val === 'number') {
          return 'Number';
        }
        if (typeof val === 'boolean') {
          return 'Boolean';
        }
        if (val instanceof Date) {
          return 'Date';
        }
        return 'Mixed';
      };
      const walk = (obj, prefix, depth) => {
        if (obj == null || typeof obj !== 'object' || depth > maxDepth) {
          return;
        }
        if (Array.isArray(obj) || this.isSleuthLeafBSON(obj)) {
          return;
        }
        for (const key of Object.keys(obj)) {
          if (key === '__v') {
            continue;
          }
          const fullPath = prefix ? `${prefix}.${key}` : key;
          const val = obj[key];
          if (key === '_id') {
            pathMap.set('_id', { path: '_id', instance: 'ObjectId' });
            continue;
          }
          if (val == null || this.isSleuthLeafBSON(val) || typeof val !== 'object') {
            pathMap.set(fullPath, { path: fullPath, instance: instanceForLeaf(val) });
          } else if (Array.isArray(val)) {
            pathMap.set(fullPath, { path: fullPath, instance: 'Array' });
          } else {
            walk(val, fullPath, depth + 1);
          }
        }
      };
      walk(doc, '', 0);
      if (!pathMap.has('_id')) {
        pathMap.set('_id', { path: '_id', instance: 'ObjectId' });
      }
      return Array.from(pathMap.values()).sort((a, b) => {
        if (a.path === '_id' && b.path !== '_id') {
          return -1;
        }
        if (a.path !== '_id' && b.path === '_id') {
          return 1;
        }
        return a.path.localeCompare(b.path);
      });
    },
    getDocumentNote(doc) {
      const key = this.getDocumentKey(doc);
      if (!key) {
        return '';
      }
      return this.documentNotes[key] || '';
    },
    setDocumentNote(doc, value) {
      const key = this.getDocumentKey(doc);
      if (!key) {
        return;
      }
      this.documentNotes[key] = value;
    },
    async search(searchText) {
      this.searchText = searchText;
      this.documents = [];
      this.loadedAllDocs = false;
      this.status = 'loading';
      await this.loadMoreDocuments();
      this.status = 'loaded';
    },
    addPathFilter(path) {
      const unified = this.$refs.unified;
      if (unified?.$refs?.documentSearch?.addPathFilter) {
        unified.$refs.documentSearch.addPathFilter(path);
      }
    },
    async applyPendingAddFromDocumentView() {
      // When opened from a document's "Add to Sleuth" action, just add the
      // document to the current selection. Do not auto-create a case report;
      // let the user name it explicitly via the "Save as case report" modal.
      try {
        const raw = typeof window !== 'undefined' && window.sessionStorage
          ? window.sessionStorage.getItem('studio:sleuth:addDocument')
          : null;
        if (!raw) return;
        const { model, documentId } = JSON.parse(raw);
        if (!model || !documentId) return;
        window.sessionStorage.removeItem('studio:sleuth:addDocument');
        const { doc, schemaPaths } = await api.Model.getDocument({ model, documentId });
        if (!doc) return;
        if (schemaPaths && typeof schemaPaths === 'object') {
          this.schemaPathsByModel[model] = schemaPaths;
        }
        const withModel = { ...doc, model };
        const key = this.getDocumentKey(withModel);
        if (!this.selectedDocuments.some(d => this.getDocumentKey(d) === key)) {
          this.selectedDocuments.push(withModel);
        }
        if (this.currentCaseReportId && this.selectedDocuments.length > 0) {
          await this.persistCaseReportDocuments({ toastMessage: 'Document added to case report' });
        }
      } catch (e) {
        console.error('Apply pending add to Sleuth', e);
      }
    },
    getDefaultCaseReportName() {
      const now = new Date();
      const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
      return `Case report – ${date}, ${time}`;
    },
    async addSourceSelectedToSleuth() {
      // Add currently selected documents from the models view into the
      // working Sleuth selection. If a case report is already active, update it;
      // otherwise, keep the selection in-memory and prompt the user to name
      // the case report via the modal.
      const source = Array.isArray(this.sourceSelectedDocuments) ? this.sourceSelectedDocuments : [];
      const model = this.sourceModel || this.currentModel;
      for (const doc of source) {
        if (!doc || !doc._id) continue;
        const withModel = doc.model ? doc : { ...doc, model };
        const key = this.getDocumentKey(withModel);
        if (!this.selectedDocuments.some(d => this.getDocumentKey(d) === key)) {
          this.selectedDocuments.push(withModel);
        }
      }
      if (this.selectedDocuments.length === 0) return;

      if (this.currentCaseReportId) {
        await this.persistCaseReportDocuments({ toastMessage: 'Documents added to case report' });
      } else {
        // No active case report yet: open the naming modal instead of
        // auto-creating with a generated name.
        this.shouldShowCaseReportModal = true;
      }
    },
    async getDocuments() {
      // Clear previous data
      this.documents = [];
      this.schemaPaths = [];
      this.numDocuments = null;
      this.loadedAllDocs = false;

      let docsCount = 0;
      let schemaPathsReceived = false;

      // Use async generator to stream SSEs
      const params = this.buildDocumentFetchParams();
      for await (const event of api.Model.getDocumentsStream(params)) {
        if (event.schemaPaths && !schemaPathsReceived) {
          // Sort schemaPaths with _id first
          this.schemaPaths = Object.keys(event.schemaPaths).sort((k1, k2) => {
            if (k1 === '_id' && k2 !== '_id') {
              return -1;
            }
            if (k1 !== '_id' && k2 === '_id') {
              return 1;
            }
            return 0;
          }).map(key => event.schemaPaths[key]);
          if (this.currentModel) {
            this.schemaPathsByModel[this.currentModel] = event.schemaPaths;
          }
          this.syncFilteredPathsFromBrowseProjection();
          schemaPathsReceived = true;
        }
        if (event.numDocs !== undefined) {
          this.numDocuments = event.numDocs;
        }
        if (event.document) {
          this.documents.push(event.document);
          docsCount++;
        }
        if (event.message) {
          this.status = 'loaded';
          throw new Error(event.message);
        }
      }

      if (docsCount < limit) {
        this.loadedAllDocs = true;
      }
    },
    async loadCaseReport(caseReportId) {
      this.loadingCaseReport = true;
      try {
        const { caseReport } = await api.CaseReport.getCaseReport({ caseReportId });
        if (!caseReport) {
          return;
        }

        if (typeof caseReport.name === 'string') {
          this.currentCaseReportName = caseReport.name;
        }
        this.summary = typeof caseReport.summary === 'string' ? caseReport.summary : '';
        this.aiSummary = typeof caseReport.AISummary === 'string' ? caseReport.AISummary : '';

        if (!Array.isArray(caseReport.documents)) {
          this.selectedDocuments = [];
          return;
        }

        const loadedDocs = [];
        for (const entry of caseReport.documents) {
          if (!entry || !entry.documentModel) {
            continue;
          }
          // Stored shape uses documentId (see CaseReport schema); support legacy document
          const rawId = entry.documentId != null ? entry.documentId : entry.document;
          if (rawId == null || rawId === '') {
            continue;
          }
          let documentId = rawId;
          if (documentId != null && typeof documentId === 'object' && typeof documentId.toString === 'function') {
            documentId = documentId.toString();
          } else {
            documentId = String(documentId);
          }
          try {
            const { doc, schemaPaths } = await api.Model.getDocument({
              model: entry.documentModel,
              documentId
            });
            if (!doc) {
              continue;
            }
            if (schemaPaths && typeof schemaPaths === 'object') {
              this.schemaPathsByModel[entry.documentModel] = schemaPaths;
            }
            const merged = {
              ...doc,
              model: entry.documentModel
            };
            if (Array.isArray(entry.highlightedFields) && entry.highlightedFields.length > 0) {
              merged.highlightedFields = entry.highlightedFields.slice();
            }
            loadedDocs.push(merged);

            // Restore note if present
            if (typeof entry.notes === 'string' && entry.notes.trim().length > 0) {
              const key = this.getDocumentKey(merged);
              if (key) {
                this.documentNotes[key] = entry.notes.trim();
              }
            }
          } catch (err) {
            console.error('Error loading document for case report', entry, err);
          }
        }

        this.selectedDocuments = loadedDocs.length > 0 ? loadedDocs : [];
        this.seedProjectionTextFromHighlightedFields(loadedDocs);

        if (!this.hasSourceFromModelsView && loadedDocs.length > 0) {
          const modelFromReport = loadedDocs.find(d => d && d.model)?.model;
          if (modelFromReport && !this.currentModel) {
            this.currentModel = String(modelFromReport);
          }
          if (this.currentModel) {
            try {
              await this.getDocuments();
            } catch (err) {
              console.error('Error loading documents for case report browse', err);
              this.error = err?.message || 'Error loading documents';
            }
            this.$nextTick(() => this.attachScrollListener());
          }
        }
      } finally {
        this.loadingCaseReport = false;
      }
    },
    async loadMoreDocuments() {
      let docsCount = 0;
      let numDocsReceived = false;

      // Use async generator to stream SSEs
      const params = this.buildDocumentFetchParams({ skip: this.documents.length });
      for await (const event of api.Model.getDocumentsStream(params)) {
        if (event.numDocs !== undefined && !numDocsReceived) {
          this.numDocuments = event.numDocs;
          numDocsReceived = true;
        }
        if (event.document) {
          this.documents.push(event.document);
          docsCount++;
        }
        if (event.message) {
          this.status = 'loaded';
          throw new Error(event.message);
        }
      }

      if (docsCount < limit) {
        this.loadedAllDocs = true;
      }
    },
    async checkIfScrolledToBottom() {
      if (this.status === 'loading' || this.loadedAllDocs || !this.currentModel) {
        return;
      }
      const container = this.getBrowseScrollContainer();
      if (container && container.scrollHeight - container.clientHeight - 100 < container.scrollTop) {
        this.status = 'loading';
        await this.loadMoreDocuments();
        this.status = 'loaded';
      }
    },
    filterDocument(doc) {
      return this.filterInvestigationDocument(doc);
    },
    getComponentForPath(schemaPath) {
      if (schemaPath.instance === 'Array') {
        return 'list-array';
      }
      if (schemaPath.instance === 'String') {
        return 'list-string';
      }
      if (schemaPath.instance == 'Embedded') {
        return 'list-subdocument';
      }
      if (schemaPath.instance == 'Mixed') {
        return 'list-mixed';
      }
      return 'list-default';
    },
    getReferenceModel(schemaPath) {
      return schemaPath.ref;
    },
    getValueForPath(doc, path) {
      return mpath.get(path, doc);
    },
    isDocumentSelected(document) {
      if (!document || document._id == null || !this.currentModel) {
        return false;
      }
      return this.selectedDocuments.some(x =>
        x._id.toString() === document._id.toString() && x.model === this.currentModel
      );
    },
    async addDocumentFromBrowse(document) {
      if (!document || document._id == null || !this.currentModel) {
        return;
      }
      if (this.isDocumentSelected(document)) {
        return;
      }
      const documentWithModel = { ...document, model: this.currentModel };
      this.selectedDocuments.push(documentWithModel);
      if (this.currentCaseReportId) {
        await this.persistCaseReportDocuments({ toastMessage: 'Document added to case report' });
      }
    },
    async handleDocumentSelection(document, event) {
      const documentWithModel = { ...document, model: this.currentModel };
      const index = this.selectedDocuments.findIndex(x =>
        x._id.toString() === document._id.toString() && x.model === this.currentModel
      );

      const wasAdd = index === -1;
      if (index !== -1) {
        this.selectedDocuments.splice(index, 1);
      } else {
        this.selectedDocuments.push(documentWithModel);
      }

      if (this.currentCaseReportId) {
        await this.persistCaseReportDocuments({
          toastMessage: wasAdd ? 'Document added to case report' : 'Document removed from case report'
        });
      }
    },
    async removeSelectedDocument(doc) {
      const key = this.getDocumentKey(doc);
      if (!key) {
        return;
      }
      const index = this.selectedDocuments.findIndex(x => this.getDocumentKey(x) === key);
      if (index !== -1) {
        this.selectedDocuments.splice(index, 1);
        if (this.currentCaseReportId) {
          await this.persistCaseReportDocuments({ toastMessage: 'Document removed from case report' });
        }
      }
    },
    async saveCaseReport() {
      if (!this.caseReportName || this.caseReportName.trim().length === 0) {
        this.$toast.warning('Case report name is required');
        return;
      }

      const documentsPayload = this.buildDocumentsPayload();

      if (documentsPayload.length === 0) {
        this.$toast.warning('Select at least one document. Choose one or more documents before creating a case report.');
        return;
      }

      try {
        const trimmedName = this.caseReportName.trim();
        const { caseReport } = await api.CaseReport.createCaseReport({
          name: trimmedName,
          documents: documentsPayload
        });
        if (caseReport && caseReport._id) {
          this.currentCaseReportId = caseReport._id != null ? String(caseReport._id) : caseReport._id;
        }
        this.currentCaseReportName = trimmedName;
        this.shouldShowCaseReportModal = false;
        this.caseReportName = '';
        this.$toast.success('Case report created!');
      } catch (error) {
        console.error('Error saving case report', error);
        this.$toast.error(error?.message || 'Error saving case report');
      }
    },
    async saveInvestigationProgress() {
      if (!this.currentCaseReportId) {
        this.$toast.error('No case report to save yet.');
        return;
      }

      const documentsPayload = this.buildDocumentsPayload();

      try {
        await api.CaseReport.updateCaseReport({
          caseReportId: this.currentCaseReportId,
          documents: documentsPayload
        });
        this.$toast.success('Progress saved');
      } catch (err) {
        console.error('Error saving progress', err);
        this.$toast.error(err?.message || 'Error saving progress');
      }
    },
    async saveDocumentNote(doc) {
      if (!this.currentCaseReportId) {
        this.$toast.warning('Create or open a case report before saving notes.');
        return;
      }
      const documentsPayload = this.buildDocumentsPayload();
      try {
        await api.CaseReport.updateCaseReport({
          caseReportId: this.currentCaseReportId,
          documents: documentsPayload
        });
        const label = this.getInvestigationDocumentHeading(doc);
        this.$toast.success(label ? `Note saved (${label})` : 'Note saved');
      } catch (err) {
        console.error('Error saving note', err);
        this.$toast.error(err?.message || 'Error saving note');
        throw err;
      }
    },
    async saveSummary() {
      if (!this.currentCaseReportId) {
        this.$toast.error('No case report to save yet.');
        return;
      }

      const documentsPayload = this.buildDocumentsPayload();
      const summaryTrimmed = (this.summary || '').trim();

      try {
        await api.CaseReport.updateCaseReport({
          caseReportId: this.currentCaseReportId,
          documents: documentsPayload,
          summary: this.summary || '',
          skipAISummary: true
        });
      } catch (err) {
        console.error('Error saving summary', err);
        this.$toast.error(err?.message || 'Error saving summary');
        return;
      }

      const query = summaryTrimmed ? { generateAiSummary: '1' } : {};

      if (this.$router && this.currentCaseReportId) {
        try {
          await this.$router.push({
            name: 'case-report',
            params: { caseReportId: this.currentCaseReportId },
            query
          });
        } catch (navErr) {
          const msg = String(navErr && navErr.message ? navErr.message : '');
          const isDup =
            navErr &&
            (navErr.name === 'NavigationDuplicated' || msg.includes('redundant navigation'));
          if (isDup) {
            await this.maybeRunPendingAISummary();
          } else {
            console.error('Error navigating to case report', navErr);
            this.$toast.error(navErr?.message || 'Error opening case report');
            return;
          }
        }
      }

      if (summaryTrimmed) {
        this.$toast.success('Opening your case report to generate the AI summary…');
      } else {
        this.$toast.success('Summary saved.');
      }
    },
    async maybeRunPendingAISummary() {
      const want =
        this.$route?.query?.generateAiSummary === '1' ||
        this.$route?.query?.generateAiSummary === 'true';
      if (!want || !this.currentCaseReportId) {
        return;
      }
      if (this.deferredAISummaryInProgress) {
        return;
      }

      this.deferredAISummaryInProgress = true;
      this.savingSummary = true;
      try {
        const { caseReport, aiSummary } = await api.CaseReport.generateCaseReportAISummary({
          caseReportId: this.currentCaseReportId
        });
        const resolvedAi =
          (typeof aiSummary === 'string' && aiSummary.trim().length > 0 ? aiSummary : null) ||
          (caseReport && typeof caseReport.AISummary === 'string' && caseReport.AISummary.trim().length > 0
            ? caseReport.AISummary
            : null);
        if (resolvedAi) {
          this.aiSummary = resolvedAi;
        }
        this.$toast.success(resolvedAi ? 'Case report completed with AI summary.' : 'AI summary was not generated.');
      } catch (err) {
        console.error('Error generating AI summary', err);
        this.$toast.error(err?.message || 'Error generating AI summary');
      } finally {
        this.savingSummary = false;
        this.deferredAISummaryInProgress = false;
        if (want && this.$router && this.currentCaseReportId) {
          try {
            await this.$router.replace({
              name: 'case-report',
              params: { caseReportId: String(this.currentCaseReportId) },
              query: {}
            });
          } catch (replaceErr) {
            console.error('Error clearing case report query', replaceErr);
          }
        }
      }
    }
  }
});
