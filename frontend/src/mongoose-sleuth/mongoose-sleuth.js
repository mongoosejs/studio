'use strict';

const api = require('../api');
const template = require('./mongoose-sleuth.html');
const mpath = require('mpath');

const limit = 20;
const OUTPUT_TYPE_STORAGE_KEY = 'studio:mongoose-sleuth-output-type';

module.exports = app => app.component('mongoose-sleuth', {
  template: template,
  props: [],
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
    expandedModels: {}
  }),
  created() {
    this.loadOutputPreference();
  },
  beforeDestroy() {
    const container = this.$refs.aggregating?.$refs?.documentsList?.querySelector('.documents-container');
    if (container) {
      container.removeEventListener('scroll', this.onScroll, true);
    }
  },
  async mounted() {
    this.onScroll = () => this.checkIfScrolledToBottom();
    const container = this.$refs.aggregating?.$refs?.documentsList?.querySelector('.documents-container');
    if (container) {
      container.addEventListener('scroll', this.onScroll, true);
    }
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

    // If opened with an existing case report, load it and go to Step 2
    const caseReportId = this.$route?.query?.caseReportId;
    if (caseReportId) {
      this.currentCaseReportId = caseReportId;
      try {
        await this.loadCaseReport(caseReportId);
      } catch (err) {
        console.error('Error loading case report', err);
        this.$toast.error(`Error loading case report: ${err?.message || 'Unknown error'}`);
      }
    }
  },
  updated() {
    // Re-attach scroll listener when documents container is updated
    this.$nextTick(() => {
      const container = this.$refs.aggregating?.$refs?.documentsList?.querySelector('.documents-container');
      if (container) {
        container.removeEventListener('scroll', this.onScroll, true);
        container.addEventListener('scroll', this.onScroll, true);
      }
    });
  },
  computed: {
    referenceMap() {
      const map = {};
      for (const path of this.filteredPaths) {
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
      // Convert to array of { model, documents } for easier iteration
      return Object.keys(grouped).map(model => ({
        model,
        documents: grouped[model]
      }));
    }
  },
  methods: {
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
        const base = {
          document: doc._id,
          documentModel: doc.model
        };
        const note = this.getDocumentNote(doc);
        base.notes = note.trim();
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
          await api.Sleuth.updateCaseReport({
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
      // Attach scroll listener after documents are loaded
      this.$nextTick(() => {
        const container = this.$refs.aggregating?.$refs?.documentsList?.querySelector('.documents-container');
        if (container) {
          container.removeEventListener('scroll', this.onScroll, true);
          container.addEventListener('scroll', this.onScroll, true);
        }
      });
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
      const aggregating = this.$refs.aggregating;
      if (aggregating?.$refs?.documentSearch?.addPathFilter) {
        aggregating.$refs.documentSearch.addPathFilter(path);
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
      const { caseReport } = await api.Sleuth.getCaseReport({ caseReportId });
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
        // Open directly to Step 2 when a case report already has documents
        this.activeStep = 'investigating';
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
      const container = this.$refs.aggregating?.$refs?.documentsList?.querySelector('.documents-container');
      if (container && container.scrollHeight - container.clientHeight - 100 < container.scrollTop) {
        this.status = 'loading';
        await this.loadMoreDocuments();
        this.status = 'loaded';
      }
    },
    filterDocument(doc) {
      const filteredDoc = {};
      for (let i = 0; i < this.filteredPaths.length; i++) {
        const path = this.filteredPaths[i].path;
        const value = mpath.get(path, doc);
        mpath.set(path, value, filteredDoc);
      }
      return filteredDoc;
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
        const { caseReport } = await api.Sleuth.createCaseReport({
          name: this.caseReportName.trim(),
          documents: documentsPayload
        });
        if (caseReport && caseReport._id) {
          this.currentCaseReportId = caseReport._id;
        }
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
        await api.Sleuth.updateCaseReport({
          caseReportId: this.currentCaseReportId,
          documents: documentsPayload
        });
        this.$toast.success('Progress saved');
      } catch (err) {
        console.error('Error saving progress', err);
        this.$toast.error(err?.message || 'Error saving progress');
      }
    }
  }
});
