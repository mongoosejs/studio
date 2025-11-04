'use strict';

const api = require('../api');
const template = require('./models.html');
const mpath = require('mpath');

const appendCSS = require('../appendCSS');
const { Trie } = require('./trie');

const QUERY_SELECTORS = [
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$exists',
  '$regex',
  '$options',
  '$text',
  '$search',
  '$and',
  '$or',
  '$nor',
  '$not',
  '$elemMatch',
  '$size',
  '$all',
  '$type',
  '$expr',
  '$jsonSchema',
  '$mod'
];


appendCSS(require('./models.css'));

const limit = 20;
const OUTPUT_TYPE_STORAGE_KEY = 'studio:model-output-type';

module.exports = app => app.component('models', {
  template: template,
  props: ['model', 'user', 'roles'],
  data: () => ({
    models: [],
    currentModel: null,
    documents: [],
    schemaPaths: [],
    filteredPaths: [],
    selectedPaths: [],
    numDocuments: null,
    mongoDBIndexes: [],
    schemaIndexes: [],
    status: 'loading',
    loadedAllDocs: false,
    edittingDoc: null,
    docEdits: null,
    selectMultiple: false,
    selectedDocuments: [],
    searchText: '',
    autocompleteSuggestions: [],
    autocompleteIndex: 0,
    autocompleteTrie: null,
    shouldShowExportModal: false,
    shouldShowCreateModal: false,
    shouldShowFieldModal: false,
    shouldShowIndexModal: false,
    shouldShowUpdateMultipleModal: false,
    shouldShowDeleteMultipleModal: false,
    shouldExport: {},
    sortBy: {},
    query: {},
    scrollHeight: 0,
    interval: null,
    outputType: 'table', // json, table
    hideSidebar: null,
    lastSelectedIndex: null,
    error: null
  }),
  created() {
    this.currentModel = this.model;
    this.buildAutocompleteTrie();
    this.loadOutputPreference();
  },
  beforeDestroy() {
    document.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('popstate', this.onPopState, true);
  },
  async mounted() {
    this.onScroll = () => this.checkIfScrolledToBottom();
    document.addEventListener('scroll', this.onScroll, true);
    this.onPopState = () => this.initSearchFromUrl();
    window.addEventListener('popstate', this.onPopState, true);
    const { models, readyState } = await api.Model.listModels();
    this.models = models;
    if (this.currentModel == null && this.models.length > 0) {
      this.currentModel = this.models[0];
    }
    if (this.models.length === 0) {
      this.status = 'loaded';
      this.numDocuments = 0;
      if (readyState === 0) {
        this.error = 'No models found and Mongoose is not connected. Check our documentation for more information.';
      }
    }

    await this.initSearchFromUrl();
  },
  methods: {
    buildAutocompleteTrie() {
      this.autocompleteTrie = new Trie();
      this.autocompleteTrie.bulkInsert(QUERY_SELECTORS, 5);
      if (Array.isArray(this.schemaPaths) && this.schemaPaths.length > 0) {
        const paths = this.schemaPaths
          .map(path => path?.path)
          .filter(path => typeof path === 'string' && path.length > 0);
        this.autocompleteTrie.bulkInsert(paths, 10);
      }
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
    async initSearchFromUrl() {
      this.status = 'loading';
      this.query = Object.assign({}, this.$route.query); // important that this is here before the if statements
      if (this.$route.query?.search) {
        this.searchText = this.$route.query.search;
      } else {
        this.searchText = '';
      }
      if (this.$route.query?.sort) {
        const sort = eval(`(${this.$route.query.sort})`);
        const path = Object.keys(sort)[0];
        const num = Object.values(sort)[0];
        this.sortDocs(num, path);
      }


      if (this.currentModel != null) {
        await this.getDocuments();
      }
      if (this.$route.query?.fields) {
        const filter = this.$route.query.fields.split(',');
        this.filteredPaths = this.filteredPaths.filter(x => filter.includes(x.path));
      }
      this.status = 'loaded';
    },
    async dropIndex(name) {
      const { mongoDBIndexes } = await api.Model.dropIndex({ model: this.currentModel, name });
      this.mongoDBIndexes = mongoDBIndexes;
    },
    initFilter(ev) {
      if (!this.searchText) {
        this.searchText = '{}';
        this.$nextTick(() => {
          ev.target.setSelectionRange(1, 1);
        });
      }
    },
    updateAutocomplete() {
      const input = this.$refs.searchInput;
      const cursorPos = input ? input.selectionStart : 0;
      const before = this.searchText.slice(0, cursorPos);
      const match = before.match(/(?:\{|,)\s*([^:\s]*)$/);
      if (match && match[1]) {
        const token = match[1];
        const leadingQuoteMatch = token.match(/^["']/);
        const trailingQuoteMatch = token.length > 1 && /["']$/.test(token)
          ? token[token.length - 1]
          : '';
        const term = token
          .replace(/^["']/, '')
          .replace(trailingQuoteMatch ? new RegExp(`[${trailingQuoteMatch}]$`) : '', '')
          .trim();
        if (!term) {
          this.autocompleteSuggestions = [];
          return;
        }
        if (this.autocompleteTrie) {
          const primarySuggestions = this.autocompleteTrie.getSuggestions(term, 10);
          const suggestionsSet = new Set(primarySuggestions);
          if (Array.isArray(this.schemaPaths) && this.schemaPaths.length > 0) {
            for (const schemaPath of this.schemaPaths) {
              const path = schemaPath?.path;
              if (
                typeof path === 'string' &&
                path.startsWith(`${term}.`) &&
                !suggestionsSet.has(path)
              ) {
                suggestionsSet.add(path);
                if (suggestionsSet.size >= 10) {
                  break;
                }
              }
            }
          }
          let suggestions = Array.from(suggestionsSet);
          if (leadingQuoteMatch) {
            const leadingQuote = leadingQuoteMatch[0];
            suggestions = suggestions.map(suggestion => `${leadingQuote}${suggestion}`);
          }
          if (trailingQuoteMatch) {
            suggestions = suggestions.map(suggestion =>
              suggestion.endsWith(trailingQuoteMatch) ? suggestion : `${suggestion}${trailingQuoteMatch}`
            );
          }
          this.autocompleteSuggestions = suggestions;
          this.autocompleteIndex = 0;
          return;
        }
      }
      this.autocompleteSuggestions = [];
    },
    handleKeyDown(ev) {
      if (this.autocompleteSuggestions.length === 0) {
        return;
      }
      if (ev.key === 'Tab' || ev.key === 'Enter') {
        ev.preventDefault();
        this.applySuggestion(this.autocompleteIndex);
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        this.autocompleteIndex = (this.autocompleteIndex + 1) % this.autocompleteSuggestions.length;
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        this.autocompleteIndex = (this.autocompleteIndex + this.autocompleteSuggestions.length - 1) % this.autocompleteSuggestions.length;
      }
    },
    applySuggestion(index) {
      const suggestion = this.autocompleteSuggestions[index];
      if (!suggestion) {
        return;
      }
      const input = this.$refs.searchInput;
      const cursorPos = input.selectionStart;
      const before = this.searchText.slice(0, cursorPos);
      const after = this.searchText.slice(cursorPos);
      const match = before.match(/(?:\{|,)\s*([^:\s]*)$/);
      const colonNeeded = !/^\s*:/.test(after);
      if (!match) {
        return;
      }
      const token = match[1];
      const start = cursorPos - token.length;
      let replacement = suggestion;
      const leadingQuote = token.startsWith('"') || token.startsWith('\'') ? token[0] : '';
      const trailingQuote = token.length > 1 && (token.endsWith('"') || token.endsWith('\'')) ? token[token.length - 1] : '';
      if (leadingQuote && !replacement.startsWith(leadingQuote)) {
        replacement = `${leadingQuote}${replacement}`;
      }
      if (trailingQuote && !replacement.endsWith(trailingQuote)) {
        replacement = `${replacement}${trailingQuote}`;
      }
      // Only insert : if we know the user isn't entering in a nested path
      if (colonNeeded && (!leadingQuote || trailingQuote)) {
        replacement = `${replacement}:`;
      }
      this.searchText = this.searchText.slice(0, start) + replacement + after;
      this.$nextTick(() => {
        const pos = start + replacement.length;
        input.setSelectionRange(pos, pos);
      });
      this.autocompleteSuggestions = [];
    },
    clickFilter(path) {
      if (this.searchText) {
        if (this.searchText.endsWith('}')) {
          this.searchText = this.searchText.slice(0, -1) + `, ${path}:  }`;
        } else {
          this.searchText += `, ${path}:  }`;
        }

      } else {
        // If this.searchText is empty or undefined, initialize it with a new object
        this.searchText = `{ ${path}:  }`;
      }


      this.$nextTick(() => {
        const input = this.$refs.searchInput;
        const cursorIndex = this.searchText.lastIndexOf(':') + 2; // Move cursor after ": "

        input.focus();
        input.setSelectionRange(cursorIndex, cursorIndex);
      });
    },
    async closeCreationModal() {
      this.shouldShowCreateModal = false;
      await this.getDocuments();
    },
    initializeDocumentData() {
      this.shouldShowCreateModal = true;
    },
    filterDocument(doc) {
      const filteredDoc = {};
      console.log(doc, this.filteredPaths);
      for (let i = 0; i < this.filteredPaths.length; i++) {
        filteredDoc[this.filteredPaths[i].path] = doc[this.filteredPaths[i].path];
      }
      return filteredDoc;
    },
    async checkIfScrolledToBottom() {
      if (this.status === 'loading' || this.loadedAllDocs) {
        return;
      }
      const container = this.$refs.documentsList;
      if (container.scrollHeight - container.clientHeight - 100 < container.scrollTop) {
        this.status = 'loading';
        const params = this.buildDocumentFetchParams({ skip: this.documents.length });
        const { docs } = await api.Model.getDocuments(params);
        if (docs.length < limit) {
          this.loadedAllDocs = true;
        }
        this.documents.push(...docs);
        this.status = 'loaded';
      }
    },
    async sortDocs(num, path) {
      let sorted = false;
      if (this.sortBy[path] == num) {
        sorted = true;
        delete this.query.sort;
        this.$router.push({ query: this.query });
      }
      for (const key in this.sortBy) {
        delete this.sortBy[key];
      }
      if (!sorted) {
        this.sortBy[path] = num;
        this.query.sort = `{${path}:${num}}`;
        this.$router.push({ query: this.query });
      }
      await this.loadMoreDocuments();
    },
    async search() {
      const hasSearch = typeof this.searchText === 'string' && this.searchText.trim().length > 0;
      if (hasSearch) {
        this.query.search = this.searchText;
      } else {
        delete this.query.search;
      }
      const query = this.query;
      this.$router.push({ query });
      this.documents = [];
      this.loadedAllDocs = false;
      this.status = 'loading';
      await this.loadMoreDocuments();
      this.status = 'loaded';
    },
    async openIndexModal() {
      this.shouldShowIndexModal = true;
      const { mongoDBIndexes, schemaIndexes } = await api.Model.getIndexes({ model: this.currentModel });
      this.mongoDBIndexes = mongoDBIndexes;
      this.schemaIndexes = schemaIndexes;
    },
    checkIndexLocation(indexName) {
      if (this.schemaIndexes.find(x => x.name == indexName) && this.mongoDBIndexes.find(x => x.name == indexName)) {
        return 'text-gray-500';
      } else if (this.schemaIndexes.find(x => x.name == indexName)) {
        return 'text-forest-green-500';
      } else {
        return 'text-valencia-500';
      }
    },
    async getDocuments() {
      // Clear previous data
      this.documents = [];
      this.schemaPaths = [];
      this.buildAutocompleteTrie();
      this.numDocuments = null;
      this.loadedAllDocs = false;
      this.lastSelectedIndex = null;

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
          this.shouldExport = {};
          for (const { path } of this.schemaPaths) {
            this.shouldExport[path] = true;
          }
          this.filteredPaths = [...this.schemaPaths];
          this.selectedPaths = [...this.schemaPaths];
          this.buildAutocompleteTrie();
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
    addOrRemove(path) {
      const exists = this.selectedPaths.findIndex(x => x.path == path.path);
      if (exists > 0) { // remove
        this.selectedPaths.splice(exists, 1);
      } else { // add
        this.selectedPaths.push(path);
        this.selectedPaths = Object.keys(this.selectedPaths).sort((k1, k2) => {
          if (k1 === '_id' && k2 !== '_id') {
            return -1;
          }
          if (k1 !== '_id' && k2 === '_id') {
            return 1;
          }
          return 0;
        }).map(key => this.selectedPaths[key]);
      }
    },
    openFieldSelection() {
      if (this.$route.query?.fields) {
        this.selectedPaths.length = 0;
        console.log('there are fields in play', this.$route.query.fields);
        const fields = this.$route.query.fields.split(',');
        for (let i = 0; i < fields.length; i++) {
          this.selectedPaths.push({ path: fields[i] });
        }
      } else {
        this.selectedPaths = [{ path: '_id' }];
      }
      this.shouldShowFieldModal = true;
    },
    filterDocuments() {
      if (this.selectedPaths.length > 0) {
        this.filteredPaths = [...this.selectedPaths];
      } else {
        this.filteredPaths.length = 0;
      }
      this.shouldShowFieldModal = false;
      const selectedParams = this.filteredPaths.map(x => x.path).join(',');
      this.query.fields = selectedParams;
      this.$router.push({ query: this.query });
    },
    resetDocuments() {
      this.selectedPaths = [...this.filteredPaths];
      this.query.fields = {};
      this.$router.push({ query: this.query });
      this.shouldShowFieldModal = false;
    },
    deselectAll() {
      this.selectedPaths = [];
    },
    selectAll() {
      this.selectedPaths = [...this.schemaPaths];
    },
    isSelected(path) {
      return this.selectedPaths.find(x => x.path == path);
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
    async saveDocEdits() {
      const res = await api.Model.updateDocument({
        model: this.currentModel,
        _id: this.edittingDoc._id,
        update: JSON.parse(this.docEdits)
      });

      const index = this.documents.findIndex(doc => doc === this.edittingDoc);
      if (index !== -1) {
        this.documents[index] = res.doc;
      }
      this.edittingDoc = null;
    },
    handleDocumentClick(document, event) {
      if (this.selectMultiple) {
        this.handleDocumentSelection(document, event);
      } else {
        this.openDocument(document);
      }
    },
    handleDocumentContainerClick(document, event) {
      if (this.selectMultiple) {
        this.handleDocumentSelection(document, event);
      }
    },
    handleDocumentSelection(document, event) {
      const documentIndex = this.documents.findIndex(doc => doc._id.toString() == document._id.toString());
      if (event?.shiftKey && this.selectedDocuments.length > 0) {
        const anchorIndex = this.lastSelectedIndex;
        if (anchorIndex != null && anchorIndex !== -1 && documentIndex !== -1) {
          const start = Math.min(anchorIndex, documentIndex);
          const end = Math.max(anchorIndex, documentIndex);
          const selectedDocumentIds = new Set(this.selectedDocuments.map(doc => doc._id.toString()));
          for (let i = start; i <= end; i++) {
            const docInRange = this.documents[i];
            const existsInRange = selectedDocumentIds.has(docInRange._id.toString());
            if (!existsInRange) {
              this.selectedDocuments.push(docInRange);
            }
          }
          this.lastSelectedIndex = documentIndex;
          return;
        }
      }
      const index = this.selectedDocuments.findIndex(x => x._id.toString() == document._id.toString());
      if (index !== -1) {
        this.selectedDocuments.splice(index, 1);
        if (this.selectedDocuments.length === 0) {
          this.lastSelectedIndex = null;
        } else {
          const lastDoc = this.selectedDocuments[this.selectedDocuments.length - 1];
          this.lastSelectedIndex = this.documents.findIndex(doc => doc._id.toString() == lastDoc._id.toString());
        }
      } else {
        this.selectedDocuments.push(document);
        this.lastSelectedIndex = documentIndex;
      }
    },
    openDocument(document) {
      this.$router.push('/model/' + this.currentModel + '/document/' + document._id);
    },
    async deleteDocuments() {
      const documentIds = this.selectedDocuments.map(x => x._id);
      await api.Model.deleteDocuments({
        documentIds,
        model: this.currentModel
      });
      await this.getDocuments();
      this.selectedDocuments.length = 0;
      this.lastSelectedIndex = null;
      this.shouldShowDeleteMultipleModal = false;
      this.selectMultiple = false;
    },
    async updateDocuments() {
      await this.getDocuments();
      this.selectedDocuments.length = 0;
      this.lastSelectedIndex = null;
      this.selectMultiple = false;
    },
    stagingSelect() {
      if (this.selectMultiple) {
        this.selectMultiple = false;
        this.selectedDocuments.length = 0;
        this.lastSelectedIndex = null;
      } else {
        this.selectMultiple = true;
      }
    }
  }
});
