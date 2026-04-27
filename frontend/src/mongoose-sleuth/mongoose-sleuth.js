'use strict';

const api = require('../api');
const template = require('./mongoose-sleuth.html');
const mpath = require('mpath');

const limit = 20;
const OUTPUT_TYPE_STORAGE_KEY = 'studio:mongoose-sleuth-output-type';

// Models view is mounted with router-view :key="$route.fullPath", so changing models
// remounts the parent and destroys this component. Keep working Sleuth state in
// memory so the case report / selection survives model switches.
const embeddedModelsSleuthState = {
  selectedDocuments: [],
  documentNotes: {},
  currentCaseReportId: null,
  currentCaseReportName: '',
  currentCaseReportStatus: 'created',
  summary: '',
  aiSummary: '',
  identifierPathByModel: {},
  investigationPreviewZoomPercent: 65
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
  s.currentCaseReportStatus = typeof vm.currentCaseReportStatus === 'string' ? vm.currentCaseReportStatus : 'created';
  s.summary = typeof vm.summary === 'string' ? vm.summary : '';
  s.aiSummary = typeof vm.aiSummary === 'string' ? vm.aiSummary : '';
  s.identifierPathByModel = vm.identifierPathByModel && typeof vm.identifierPathByModel === 'object'
    ? { ...vm.identifierPathByModel }
    : {};
  s.investigationPreviewZoomPercent = typeof vm.investigationPreviewZoomPercent === 'number'
    ? vm.investigationPreviewZoomPercent
    : 65;
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
  vm.currentCaseReportStatus = typeof s.currentCaseReportStatus === 'string' ? s.currentCaseReportStatus : 'created';
  vm.summary = s.summary || '';
  vm.aiSummary = s.aiSummary || '';
  vm.identifierPathByModel = s.identifierPathByModel && typeof s.identifierPathByModel === 'object'
    ? { ...s.identifierPathByModel }
    : {};
  vm.investigationPreviewZoomPercent = typeof s.investigationPreviewZoomPercent === 'number'
    ? s.investigationPreviewZoomPercent
    : 65;
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
    currentCaseReportStatus: 'created',
    updatingCaseReportStatus: false,
    // Mongoose schema paths keyed by model name (from getDocument / document stream)
    schemaPathsByModel: {},
    // Step 2: per-model Mongoose path (e.g. "email", "profile.name") used as human label
    identifierPathByModel: {},
    // Step 2: getDocumentKey -> show embedded JSON preview
    investigationDocPreviewExpanded: {},
    // Step 2: CSS zoom % for JSON preview (40–150)
    investigationPreviewZoomPercent: 65
  }),
  created() {
    this.loadOutputPreference();
  },
  beforeDestroy() {
    const container = this.$refs.unified?.$refs?.documentsList?.querySelector('.documents-container');
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

    // When embedded in models view: add document from document view if user clicked "Add to Sleuth"
    if (this.hasSourceFromModelsView) {
      this.applyPendingAddFromDocumentView();
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
      return this.caseReports.filter(cr => cr && cr.status && cr.status !== 'resolved' && cr.status !== 'archived');
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
      const container = this.$refs.unified?.$refs?.documentsList?.querySelector('.documents-container');
      if (container) {
        container.removeEventListener('scroll', this.onScroll, true);
        container.addEventListener('scroll', this.onScroll, true);
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
        if (doc.highlightedFields && doc.highlightedFields.length > 0) {
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

      return params;
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
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      this.investigationDocPreviewExpanded = next;
    },
    isInvestigationDocPreviewOpen(doc) {
      const key = this.getDocumentKey(doc);
      return !!(key && this.investigationDocPreviewExpanded[key]);
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
        // If we're already working on a case report, persist the updated docs.
        if (this.currentCaseReportId && this.selectedDocuments.length > 0) {
          const documentsPayload = this.buildDocumentsPayload();
          await api.CaseReport.updateCaseReport({
            caseReportId: this.currentCaseReportId,
            documents: documentsPayload
          });
          this.$toast.success('Case report updated');
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
        const documentsPayload = this.buildDocumentsPayload();
        try {
          await api.CaseReport.updateCaseReport({
            caseReportId: this.currentCaseReportId,
            documents: documentsPayload
          });
          this.$toast.success('Case report updated');
        } catch (err) {
          console.error('Error saving case report', err);
          this.$toast.error(err?.message || 'Error saving case report');
        }
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
          this.filteredPaths = [...this.schemaPaths];
          if (this.currentModel) {
            this.schemaPathsByModel[this.currentModel] = event.schemaPaths;
          }
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
        this.currentCaseReportStatus = typeof caseReport.status === 'string' ? caseReport.status : 'created';
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
      const container = this.$refs.unified?.$refs?.documentsList?.querySelector('.documents-container');
      if (container && container.scrollHeight - container.clientHeight - 100 < container.scrollTop) {
        this.status = 'loading';
        await this.loadMoreDocuments();
        this.status = 'loaded';
      }
    },
    filterDocument(doc) {
      return doc;
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
      return this.selectedDocuments.some(x => x._id.toString() === document._id.toString() && x.model === this.currentModel);
    },
    handleDocumentSelection(document, event) {
      const documentWithModel = { ...document, model: this.currentModel };
      const index = this.selectedDocuments.findIndex(x =>
        x._id.toString() === document._id.toString() && x.model === this.currentModel
      );

      if (index !== -1) {
        // Deselect
        this.selectedDocuments.splice(index, 1);
      } else {
        // Select
        this.selectedDocuments.push(documentWithModel);
      }
    },
    removeSelectedDocument(doc) {
      const key = this.getDocumentKey(doc);
      if (!key) {
        return;
      }
      const index = this.selectedDocuments.findIndex(x => this.getDocumentKey(x) === key);
      if (index !== -1) {
        this.selectedDocuments.splice(index, 1);
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
        if (caseReport && typeof caseReport.status === 'string') {
          this.currentCaseReportStatus = caseReport.status;
        }
        this.shouldShowCaseReportModal = false;
        this.caseReportName = '';
        this.$toast.success('Case report created!');
      } catch (error) {
        console.error('Error saving case report', error);
        this.$toast.error(error?.message || 'Error saving case report');
      }
    },
    async updateCaseReportStatus(nextStatus) {
      if (!this.currentCaseReportId) {
        return;
      }
      const allowed = new Set(['created', 'in_progress', 'cancelled', 'resolved', 'archived']);
      if (!allowed.has(nextStatus)) {
        return;
      }
      this.updatingCaseReportStatus = true;
      try {
        const { caseReport } = await api.CaseReport.updateCaseReport({
          caseReportId: this.currentCaseReportId,
          status: nextStatus
        });
        if (caseReport && typeof caseReport.status === 'string') {
          this.currentCaseReportStatus = caseReport.status;
        } else {
          this.currentCaseReportStatus = nextStatus;
        }
        try {
          const { caseReports } = await api.CaseReport.getCaseReports();
          this.caseReports = Array.isArray(caseReports) ? caseReports : [];
        } catch (listErr) {
          console.error('Error refreshing case reports list', listErr);
        }
        this.$toast.success('Case report status updated');
      } catch (err) {
        console.error('Error updating case report status', err);
        this.$toast.error(err?.message || 'Error updating status');
      } finally {
        this.updatingCaseReportStatus = false;
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
    adjustInvestigationPreviewZoom(delta) {
      const next = Math.round(this.investigationPreviewZoomPercent + delta);
      this.investigationPreviewZoomPercent = Math.min(150, Math.max(40, next));
    },
    resetInvestigationPreviewZoom() {
      this.investigationPreviewZoomPercent = 65;
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
