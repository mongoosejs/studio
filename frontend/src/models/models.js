'use strict';

const api = require('../api');
const template = require('./models.html');
const mpath = require('mpath');
const { BSON, EJSON } = require('bson');



const ObjectId = new Proxy(BSON.ObjectId, {
  apply (target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

const appendCSS = require('../appendCSS');


appendCSS(require('./models.css'));

const limit = 20;

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
    numDocuments: 0,
    mongoDBIndexes: [],
    schemaIndexes: [],
    status: 'loading',
    loadedAllDocs: false,
    edittingDoc: null,
    docEdits: null,
    filter: null,
    selectMultiple: false,
    selectedDocuments: [],
    searchText: '',
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
    outputType: 'table' // json, table
  }),
  created() {
    this.currentModel = this.model;
  },
  beforeDestroy() {
    document.removeEventListener('scroll', () => this.onScroll(), true);
  },
  async mounted() {
    document.addEventListener('scroll', () => this.onScroll(), true);
    this.models = await api.Model.listModels().then(res => res.models);
    if (this.currentModel == null && this.models.length > 0) {
      this.currentModel = this.models[0];
    }

    this.query = Object.assign({}, this.$route.query); // important that this is here before the if statements
    if (this.$route.query?.search) {
      this.searchText = this.$route.query.search;
      this.filter = eval(`(${this.$route.query.search})`);
      this.filter = EJSON.stringify(this.filter);
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
      this.filteredPaths = this.filteredPaths.filter(x => filter.includes(x.path))
    }


    this.status = 'loaded';
  },
  methods: {
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
        const cursorIndex = this.searchText.lastIndexOf(":") + 2; // Move cursor after ": "

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
      console.log(doc, this.filteredPaths)
      for (let i = 0; i < this.filteredPaths.length; i++) {
        filteredDoc[this.filteredPaths[i].path] = doc[this.filteredPaths[i].path];
      }
      return filteredDoc;
    },
    async onScroll() {
      if (this.status === 'loading' || this.loadedAllDocs) {
        return;
      }
      const container = this.$refs.documentsList;
      if (container.scrollHeight - container.clientHeight - 100 < container.scrollTop) {
        this.status = 'loading';
        const { docs } = await api.Model.getDocuments({
          model: this.currentModel,
          filter: this.filter,
          sort: this.sortBy,
          skip: this.documents.length,
          limit
        });
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
        this.query.sort = `{${path}:${num}}`
        this.$router.push({ query: this.query });
      }
      await this.loadMoreDocuments();
    },
    async search() {
      if (this.searchText && Object.keys(this.searchText).length) {
        this.filter = eval(`(${this.searchText})`);
        this.filter = EJSON.stringify(this.filter);
        this.query.search = this.searchText;
        this.$router.push({ query: this.query });
      } else {
        this.filter = {};
        delete this.query.search;
        this.$router.push({ query: this.query });
      }
      await this.loadMoreDocuments();
    },
    async openIndexModal() {
      this.shouldShowIndexModal = true;
      const { mongoDBIndexes, schemaIndexes } = await api.Model.getIndexes({ model: this.currentModel })
      this.mongoDBIndexes = mongoDBIndexes;
      this.schemaIndexes = schemaIndexes;
    },
    checkIndexLocation(indexName) {
      if (this.schemaIndexes.find(x => x.name == indexName) && this.mongoDBIndexes.find(x => x.name == indexName)) {
        return 'text-gray-500'
      } else if (this.schemaIndexes.find(x => x.name == indexName)) {
        return 'text-forest-green-500'
      } else {
        return 'text-valencia-500'
      }
    },
    async getDocuments() {
      const { docs, schemaPaths, numDocs } = await api.Model.getDocuments({
        model: this.currentModel,
        filter: this.filter,
        sort: this.sortBy,
        limit
      });
      this.documents = docs;
      if (docs.length < limit) {
        this.loadedAllDocs = true;
      }
      this.schemaPaths = Object.keys(schemaPaths).sort((k1, k2) => {
        if (k1 === '_id' && k2 !== '_id') {
          return -1;
        }
        if (k1 !== '_id' && k2 === '_id') {
          return 1;
        }
        return 0;
      }).map(key => schemaPaths[key]);
      this.numDocuments = numDocs;

      this.shouldExport = {};
      for (const { path } of this.schemaPaths) {
        this.shouldExport[path] = true;
      }
      this.filteredPaths = [...this.schemaPaths];
      this.selectedPaths = [...this.schemaPaths];
    },
    async loadMoreDocuments() {
      const { docs } = await api.Model.getDocuments({
        model: this.currentModel,
        filter: this.filter,
        sort: this.sortBy,
        limit
      });
      this.documents = docs;
      if (docs.length < limit) {
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
        console.log('there are fields in play', this.$route.query.fields)
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
    handleDocumentClick(document) {
      console.log(this.selectedDocuments);
      if (this.selectMultiple) {
        const exists = this.selectedDocuments.find(x => x._id.toString() == document._id.toString())
        if (exists) {
          const index = this.selectedDocuments.findIndex(x => x._id.toString() == document._id.toString());
          if (index !== -1) {
            this.selectedDocuments.splice(index, 1);
          }
        } else {
          this.selectedDocuments.push(document);
        }
      } else {
       this.$router.push('/model/' + this.currentModel + '/document/' + document._id)
      }
    },
    async deleteDocuments() {
      const documentIds = this.selectedDocuments.map(x => x._id);
      await api.Model.deleteDocuments({
        documentIds,
        model: this.currentModel
      });
      await this.getDocuments();
      this.selectedDocuments.length = 0;
      this.shouldShowDeleteMultipleModal = false;
      this.selectMultiple = false;
    },
    async updateDocuments() {
      
    }
  }
});
