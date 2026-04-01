'use strict';

const api = require('../api');
const template = require('./mongoose-sleuth.html');
const mpath = require('mpath');

const limit = 20;
const OUTPUT_TYPE_STORAGE_KEY = 'studio:mongoose-sleuth-output-type';

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
    activeStep: 'aggregating',
    investigationSelections: [],
    documentNotes: {},
    showSelectedDocuments: false,
    expandedModels: {},
    shouldShowFieldModal: false,
    selectedPaths: {},
    filteredPathsByModel: {},
    expandedFieldModels: {},
    summary: '',
    aiSummary: '',
    savingSummary: false,
    caseReports: [],
    currentCaseReportName: ''
  }),
  created() {
    this.loadOutputPreference();
  },
  beforeDestroy() {
    const container = this.$refs.unified?.$refs?.documentsList?.querySelector('.documents-container');
    if (container) {
      container.removeEventListener('scroll', this.onScroll, true);
    }
  },
  async mounted() {
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
        if (!doc || !doc.model) {
          continue;
        }
        if (!grouped[doc.model]) {
          grouped[doc.model] = [];
        }
        grouped[doc.model].push(doc);
      }
      return Object.keys(grouped).map(model => ({
        model,
        documents: grouped[model]
      }));
    },
    availableCaseReports() {
      if (!Array.isArray(this.caseReports)) {
        return [];
      }
      return this.caseReports.filter(cr => cr && cr.status && cr.status !== 'resolved' && cr.status !== 'archived');
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
    async goToAggregating() {
      // If we're coming from Step 2 and have an existing case report,
      // persist current notes/document state before going back.
      if (this.activeStep === 'investigating' && this.currentCaseReportId) {
        await this.saveInvestigationProgress();
      }
      this.activeStep = 'aggregating';
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
    async goToInvestigating() {
      if (this.selectedDocuments.length === 0) {
        this.$toast.warning('No documents selected. Select one or more documents in Step 1 before moving to Investigating.');
        return;
      }

      // Keep investigation selections in sync with current step 1 selections
      this.investigationSelections = this.selectedDocuments.slice();

      // If we're editing an existing case report, persist the new document selection
      if (this.currentCaseReportId) {
        const documentsPayload = this.buildDocumentsPayload();

        try {
          await api.CaseReport.updateCaseReport({
            caseReportId: this.currentCaseReportId,
            documents: documentsPayload
          });
          this.$toast.success('Case report updated');
        } catch (err) {
          console.error('Error updating case report', err);
          this.$toast.error(err?.message || 'Error updating case report');
          return;
        }
      }

      this.activeStep = 'investigating';
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
    getDocumentKey(doc) {
      if (!doc || !doc._id || !doc.model) {
        return '';
      }
      return `${String(doc.model)}:${String(doc._id)}`;
    },
    getDocumentPreview(doc) {
      if (!doc || typeof doc !== 'object') {
        return '';
      }
      // Try common fields that might be useful for identification
      const previewFields = ['name', 'title', 'email', 'username', 'label', 'description'];
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
    isInInvestigation(doc) {
      const key = this.getDocumentKey(doc);
      return this.investigationSelections.some(d => this.getDocumentKey(d) === key);
    },
    toggleInvestigationSelection(doc) {
      const key = this.getDocumentKey(doc);
      const idx = this.investigationSelections.findIndex(d => this.getDocumentKey(d) === key);
      if (idx !== -1) {
        this.investigationSelections.splice(idx, 1);
      } else {
        this.investigationSelections.push(doc);
      }
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
        const { doc } = await api.Model.getDocument({ model, documentId });
        if (!doc) return;
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
        if (!entry || !entry.document || !entry.documentModel) {
          continue;
        }
        try {
          const { doc } = await api.Model.getDocument({
            model: entry.documentModel,
            documentId: entry.document
          });
          if (!doc) {
            continue;
          }
          const merged = {
            ...doc,
            model: entry.documentModel
          };
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
        // By default, investigate all documents in the case report
        this.investigationSelections = loadedDocs.slice();
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
        // Open directly to Step 2 when a case report already has documents
        // If summary exists, go to Step 3
        this.activeStep = caseReport.summary ? 'summarize' : 'investigating';
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
      if (!doc || !doc.model) {
        return doc;
      }
      const model = doc.model;
      const filteredPaths = this.filteredPathsByModel[model];
      if (!filteredPaths || filteredPaths.length === 0) {
        return doc;
      }
      const filteredDoc = {};
      for (let i = 0; i < filteredPaths.length; i++) {
        const path = filteredPaths[i].path;
        const value = mpath.get(path, doc);
        mpath.set(path, value, filteredDoc);
      }
      return filteredDoc;
    },
    getSchemaPathsByModel() {
      // Collect schema paths grouped by model
      const pathsByModel = {};
      for (const doc of this.selectedDocuments) {
        if (!doc || typeof doc !== 'object' || !doc.model) {
          continue;
        }
        const model = doc.model;
        if (!pathsByModel[model]) {
          pathsByModel[model] = new Map();
        }
        const pathMap = pathsByModel[model];
        const collectPaths = (obj, prefix = '') => {
          for (const key in obj) {
            if (key === '__v' || key === '_id') {
              continue;
            }
            const fullPath = prefix ? `${prefix}.${key}` : key;
            if (obj[key] != null && typeof obj[key] === 'object' && !Array.isArray(obj[key]) && !(obj[key] instanceof Date) && !(obj[key].constructor && obj[key].constructor.name === 'ObjectId')) {
              collectPaths(obj[key], fullPath);
            } else {
              if (!pathMap.has(fullPath)) {
                pathMap.set(fullPath, {
                  path: fullPath,
                  instance: Array.isArray(obj[key]) ? 'Array' : typeof obj[key] === 'string' ? 'String' : typeof obj[key] === 'number' ? 'Number' : typeof obj[key] === 'boolean' ? 'Boolean' : 'Mixed'
                });
              }
            }
          }
        };
        collectPaths(doc);
        // Always include _id for each model
        if (!pathMap.has('_id')) {
          pathMap.set('_id', { path: '_id', instance: 'ObjectId' });
        }
      }
      // Convert Maps to sorted arrays
      const result = {};
      for (const model in pathsByModel) {
        const pathMap = pathsByModel[model];
        result[model] = Array.from(pathMap.values()).sort((a, b) => {
          if (a.path === '_id' && b.path !== '_id') return -1;
          if (a.path !== '_id' && b.path === '_id') return 1;
          return a.path.localeCompare(b.path);
        });
      }
      return result;
    },
    openFieldSelection() {
      if (this.selectedDocuments.length === 0) {
        this.$toast.warning('No documents selected. Select documents in Step 1 first.');
        return;
      }
      const pathsByModel = this.getSchemaPathsByModel();
      // Initialize selectedPaths per model
      this.selectedPaths = {};
      // Initialize expandedFieldModels - expand first model by default
      this.expandedFieldModels = {};
      const modelNames = Object.keys(pathsByModel);
      if (modelNames.length > 0) {
        this.expandedFieldModels[modelNames[0]] = true;
      }
      for (const model in pathsByModel) {
        if (this.filteredPathsByModel[model] && this.filteredPathsByModel[model].length > 0) {
          this.selectedPaths[model] = [...this.filteredPathsByModel[model]];
        } else {
          this.selectedPaths[model] = pathsByModel[model].length > 0 ? [{ path: '_id' }] : [];
        }
      }
      this.shouldShowFieldModal = true;
    },
    toggleFieldModelExpansion(model) {
      this.expandedFieldModels[model] = !this.expandedFieldModels[model];
    },
    isFieldModelExpanded(model) {
      return !!this.expandedFieldModels[model];
    },
    addOrRemove(model, path) {
      if (!this.selectedPaths[model]) {
        this.selectedPaths[model] = [];
      }
      const index = this.selectedPaths[model].findIndex(p => p.path === path.path);
      if (index !== -1) {
        this.selectedPaths[model].splice(index, 1);
      } else {
        this.selectedPaths[model].push(path);
      }
    },
    isSelected(model, path) {
      if (!this.selectedPaths[model]) {
        return false;
      }
      const pathStr = typeof path === 'string' ? path : path.path;
      return this.selectedPaths[model].find(p => p.path === pathStr);
    },
    selectAll(model) {
      const pathsByModel = this.getSchemaPathsByModel();
      if (pathsByModel[model]) {
        this.selectedPaths[model] = [...pathsByModel[model]];
      }
    },
    deselectAll(model) {
      this.selectedPaths[model] = [];
    },
    filterDocuments() {
      this.filteredPathsByModel = {};
      for (const model in this.selectedPaths) {
        if (this.selectedPaths[model] && this.selectedPaths[model].length > 0) {
          this.filteredPathsByModel[model] = [...this.selectedPaths[model]];
        } else {
          this.filteredPathsByModel[model] = [];
        }
      }
      this.shouldShowFieldModal = false;
    },
    resetDocuments() {
      this.filteredPathsByModel = {};
      const pathsByModel = this.getSchemaPathsByModel();
      this.selectedPaths = {};
      for (const model in pathsByModel) {
        this.selectedPaths[model] = pathsByModel[model].length > 0 ? [...pathsByModel[model]] : [];
      }
      this.shouldShowFieldModal = false;
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
    toggleModelExpansion(model) {
      if (!model) {
        return;
      }
      this.expandedModels[model] = !this.expandedModels[model];
    },
    isModelExpanded(model) {
      return !!this.expandedModels[model];
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
        // Pre-populate investigation step with all currently selected documents
        this.investigationSelections = Array.isArray(this.selectedDocuments)
          ? this.selectedDocuments.slice()
          : [];
        // Move to Step 2 automatically
        this.activeStep = 'investigating';
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
    async goToSummarize() {
      // Save investigation progress before moving to Step 3
      if (this.currentCaseReportId) {
        await this.saveInvestigationProgress();
      }
      this.activeStep = 'summarize';
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
