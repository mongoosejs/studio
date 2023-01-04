'use strict';

const api = require('../api');
const template = require('./models.html');

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
    status: 'init',
    edittingDoc: null,
    docEdits: null
  }),
  created() {
    this.currentModel = this.model;
  },
  async mounted() {
    this.models = await api.Model.listModels().then(res => res.models);
    if (this.currentModel == null && this.models.length > 0) {
      this.currentModel = this.models[0];
    }

    if (this.currentModel != null) {
      const { docs, schemaPaths } = await api.Model.getDocuments({ model: this.currentModel });
      this.documents = docs;
      this.schemaPaths = Object.keys(schemaPaths).sort((k1, k2) => {
        if (k1 === '_id' && k2 !== '_id') {
          return -1;
        }
        if (k1 !== '_id' && k2 === '_id') {
          return 1;
        }
        return 0;
      });
    }

    this.status = 'loaded';
  },
  methods: {
    shouldShowEditModal() {
      return this.edittingDoc != null;
    },
    openEditModal(doc) {
      this.edittingDoc = doc;
      this.docEdits = JSON.stringify(doc, null, '  ');
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