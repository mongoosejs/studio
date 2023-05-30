'use strict';

const api = require('../api');
const template = require('./models.html');
const EJSON = require('ejson');

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
    sortBy: {}
  }),
  created() {
    this.currentModel = this.model;
  },
  async mounted() {
    this.models = await api.Model.listModels().then(res => res.models);
    if (this.currentModel == null && this.models.length > 0) {
      this.currentModel = this.models[0];
    }
    if (this.$route.query?.search) {
      this.searchText = this.$route.query.search;
      this.filter = eval(`(${this.$route.query.search})`);
      this.filter = EJSON.stringify(this.filter);
    }

    if (this.currentModel != null) {
      await this.getDocuments();
    }

    this.status = 'loaded';
  },
  methods: {
    async sortDocs(num, path) {
      let sorted = false;
      if (this.sortBy[path] == num) {
        sorted = true;
      }
      for (const key in this.sortBy) {
        delete this.sortBy[key];
      }
      if (!sorted) {
        this.sortBy[path] = num;
      }
      await this.getDocuments();
    },
    async search() {
      if (this.searchText && Object.keys(this.searchText).length) {
        this.filter = eval(`(${this.searchText})`);
        this.filter = EJSON.stringify(this.filter);
        this.$router.push({ path: this.$route.path, query: { search: this.searchText }})
      } else {
        this.filter = {};
        this.$router.push({ path: this.$route.path });
      }
      await this.getDocuments();
    },
    async getDocuments() {
      const { docs, schemaPaths, numDocs } = await api.Model.getDocuments({
        model: this.currentModel,
        filter: this.filter,
        sort: this.sortBy
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
      return schemaPath.options?.ref;
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