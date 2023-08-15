'use strict';

const api = require('../api');
const template = require('./models.html');
const EJSON = require('ejson');
const mpath = require('mpath');

const appendCSS = require('../appendCSS');

appendCSS(require('./models.css'));

module.exports = app => app.component('models', {
  template: template,
  props: ['model'],
  data: () => ({
    models: [],
    currentModel: null,
    documents: [],
    schemaPaths: [],
    numDocuments: 0,
    status: 'init',
    edittingDoc: null,
    docEdits: null,
    filter: null,
    searchText: '',
    shouldShowExportModal: false,
    shouldExport: {},
    sortBy: {},
    query: {},
    scrollHeight: 0,
    limit: 50,
    interval: null
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

    this.status = 'loaded';
  },
  methods: {
    async onScroll() {
      if (this.status === 'loading') {
        return;
      }
      const container = this.$refs.documentsList;
      if (container.scrollHeight - container.clientHeight - 100 < container.scrollTop) {
        this.status = 'loading';
        this.limit += 50;
        await this.getDocuments();
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
      await this.getDocuments();
    },
    async search() {
      if (this.searchText && Object.keys(this.searchText).length) {
        this.filter = eval(`(${this.searchText})`);
        this.filter = EJSON.stringify(this.filter);
        this.query.search = this.searchText;
        this.$router.push({ path: this.$route.path, query: this.query })
      } else {
        this.filter = {};
        delete this.query.search;
        this.$router.push({ path: this.$route.path, query: this.query });
      }
      await this.getDocuments();
    },
    async getDocuments() {
      const { docs, schemaPaths, numDocs } = await api.Model.getDocuments({
        model: this.currentModel,
        filter: this.filter,
        sort: this.sortBy,
        limit: this.limit
      });
      this.documents = docs;
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
    }
  }
});