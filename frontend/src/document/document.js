'use strict';

const api = require('../api');
const mpath = require('mpath');
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
    invalid: {},
    editting: false,
    virtuals: [],
    shouldShowConfirmModal: false,
    shouldShowDeleteModal: false
  }),
  async mounted() {
    window.pageState = this;
    const { doc, schemaPaths } = await api.Model.getDocument({ model: this.model, documentId: this.documentId });
    window.doc = doc;
    this.document = doc;
    this.schemaPaths = await Object.keys(schemaPaths).sort((k1, k2) => {
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
    cancelEdit() {
      this.changes = {};
      this.editting = false;
    },
    async save() {
      if (Object.keys(this.invalid).length > 0) {
        throw new Error('Invalid paths: ' + Object.keys(this.invalid).join(', '));
      }
      const { doc } = await api.Model.updateDocument({
        model: this.model,
        _id: this.document._id,
        update: this.changes
      });
      this.document = doc;
      this.changes = {};
      this.editting = false;
      this.shouldShowConfirmModal = false;
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