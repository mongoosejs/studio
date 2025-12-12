'use strict';

const api = require('../api');
const template = require('./mongoose-sleuth.html');
const mpath = require('mpath');

const limit = 20;
const OUTPUT_TYPE_STORAGE_KEY = 'studio:mongoose-sleuth-output-type';

module.exports = app => app.component('mongoose-sleuth', {
  template: template,
  props: [],
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
    caseReportName: ''
  }),
  created() {
    this.loadOutputPreference();
  },
  beforeDestroy() {
    const container = this.$refs.documentsList?.querySelector('.documents-container');
    if (container) {
      container.removeEventListener('scroll', this.onScroll, true);
    }
  },
  async mounted() {
    this.onScroll = () => this.checkIfScrolledToBottom();
    const container = this.$refs.documentsList?.querySelector('.documents-container');
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
  },
  updated() {
    // Re-attach scroll listener when documents container is updated
    this.$nextTick(() => {
      const container = this.$refs.documentsList?.querySelector('.documents-container');
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
    }
  },
  methods: {
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
        const container = this.$refs.documentsList?.querySelector('.documents-container');
        if (container) {
          container.removeEventListener('scroll', this.onScroll, true);
          container.addEventListener('scroll', this.onScroll, true);
        }
      });
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
      if (this.$refs.documentSearch?.addPathFilter) {
        this.$refs.documentSearch.addPathFilter(path);
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
      const container = this.$refs.documentsList?.querySelector('.documents-container');
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
    async saveCaseReport() {
      if (!this.caseReportName || this.caseReportName.trim().length === 0) {
        return;
      }

      try {
        await api.Sleuth.createCaseReport({ name: this.caseReportName.trim() });
        this.shouldShowCaseReportModal = false;
        this.caseReportName = '';
        // Show success message (you might want to use a toast notification here)
        alert('Case report saved successfully!');
      } catch (error) {
        console.error('Error saving case report', error);
        alert('Error saving case report: ' + (error.message || 'Unknown error'));
      }
    }
  }
});
