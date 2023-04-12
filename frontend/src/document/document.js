'use strict';

const api = require('../api');
const template = require('./document.html');
const vanillatoast = require('vanillatoasts');

const appendCSS = require('../appendCSS');

appendCSS(require('./document.css'));

module.exports = app => app.component('document', {
  template: template,
  props: ['model', 'documentId'],
  data: () => ({
    schemaPaths: [],
    status: 'init',
    document: null,
    changes: {},
    editting: false
  }),
  async mounted() {
    const { doc, schemaPaths } = await api.Model.getDocument({ model: this.model, documentId: this.documentId });
    this.document = doc;
    this.schemaPaths = Object.keys(schemaPaths).sort((k1, k2) => {
      if (k1 === '_id' && k2 !== '_id') {
        return -1;
      }
      if (k1 !== '_id' && k2 === '_id') {
        return 1;
      }
      return 0;
    }).map(key => schemaPaths[key]);

    this.status = 'loaded';
  },
  methods: {
    getComponentForPath(schemaPath) {
      if (schemaPath.instance === 'Array') {
        return 'detail-array';
      }
      return 'detail-default';
    },
    getEditComponentForPath(path) {
      if (path.instance == 'Date') {
        return 'edit-date';
      }
      if (path.instance == 'Number') {
        return 'edit-number';
      }
      return 'edit-default';
    },
    getEditValueForPath({ path }) {
      return path in this.changes ? this.changes[path] : this.document[path];
    },
    cancelEdit() {
      this.changes = {};
      this.editting = false;
    },
    async save() {
      const { doc } = await api.Model.updateDocument({
        model: this.model,
        _id: this.document._id,
        update: this.changes
      });
      this.document = doc;
      this.changes = {};
      this.editting = false;
    },
    async remove() {
      const { doc } = await api.Model.deleteDocument({
        model: this.model,
        documentId: this.document._id
      });
      if (doc.acknowledged) {
        this.editting = false;
        this.document = {};
        vanillatoast.create({
          title: 'Document Deleted!',
          type: 'success',
          timeout: 3000,
          positionClass: 'bottomRight'
        });
        this.$router.push({ path: `/model/${this.model}`});
      }
    }
  }
});