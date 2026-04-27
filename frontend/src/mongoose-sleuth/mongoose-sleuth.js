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
  summary: '',
  aiSummary: '',
  identifierPathByModel: {}
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
    caseReports: [],
    currentCaseReportName: '',
    // Mongoose schema paths keyed by model name (from getDocument / document stream)
    schemaPathsByModel: {},
    // Step 2: per-model Mongoose path (e.g. "email", "profile.name") used as human label
    identifierPathByModel: {},
    // Step 2: getDocumentKey -> show embedded JSON preview
    investigationDocPreviewExpanded: {}
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
        const existing = this.caseReports.find(cr => cr && String(cr._id) === String(caseReportId));
        this.currentCaseReportName = existing && existing.name ? existing.name : '';
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
      const { caseReport } = await api.CaseReport.getCaseReport({ caseReportId });
      if (!caseReport || !Array.isArray(caseReport.documents)) {
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

      if (loadedDocs.length > 0) {
        this.selectedDocuments = loadedDocs;
        // Restore summary if present
        if (typeof caseReport.summary === 'string') {
          this.summary = caseReport.summary;
        }
        // Restore AI summary if present
        if (typeof caseReport.AISummary === 'string') {
          this.aiSummary = caseReport.AISummary;
        }
        // Store current case report name for display
        if (typeof caseReport.name === 'string') {
          this.currentCaseReportName = caseReport.name;
        }
      } else {
        this.selectedDocuments = [];
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
    async saveSummary() {
      if (!this.currentCaseReportId) {
        this.$toast.error('No case report to save yet.');
        return;
      }

      const documentsPayload = this.buildDocumentsPayload();

      this.savingSummary = true;
      try {
        const { caseReport, aiSummary } = await api.CaseReport.updateCaseReport({
          caseReportId: this.currentCaseReportId,
          documents: documentsPayload,
          summary: this.summary || ''
        });
        if (aiSummary) {
          this.aiSummary = aiSummary;
          this.$toast.success('Summary saved and AI summary requested');
        } else {
          this.$toast.success('Summary saved');
        }
        // After saving summary, navigate to the full case report page so the
        // user can continue the investigation outside the sidebar.
        if (this.$router && this.currentCaseReportId) {
          this.$router.push({
            name: 'case-report',
            params: { caseReportId: this.currentCaseReportId }
          });
        }
      } catch (err) {
        console.error('Error saving summary', err);
        this.$toast.error(err?.message || 'Error saving summary');
      } finally {
        this.savingSummary = false;
      }
    }
  }
});
