'use strict';

const api = require('../api');
const mpath = require('mpath');
const template = require('./document.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./document.css'));

module.exports = app => app.component('document', {
  template: template,
  props: ['model', 'documentId', 'user', 'roles', 'hasAPIKey'],
  data: () => ({
    schemaPaths: [],
    status: 'init',
    document: null,
    changes: {},
    invalid: {},
    editting: false,
    virtuals: [],
    virtualPaths: [],
    mobileMenuOpen: false,
    desktopMenuOpen: false,
    viewMode: 'fields',
    shouldShowConfirmModal: false,
    shouldShowDeleteModal: false,
    shouldShowCloneModal: false,
    previousQuery: null
  }),
  async mounted() {
    window.pageState = this;
    // Store query parameters from the route (preserved from models page)
    this.previousQuery = Object.assign({}, this.$route.query);
    try {
      const { doc, schemaPaths, virtualPaths } = await api.Model.getDocument({ model: this.model, documentId: this.documentId });
      window.doc = doc;
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
      this.virtualPaths = virtualPaths || [];
      this.status = 'loaded';
    } finally {
      this.status = 'loaded';
    }
  },
  computed: {
    canManipulate() {
      if (!this.hasAPIKey) {
        return true;
      }
      if (!this.roles) {
        return false;
      }
      return !this.roles.includes('readonly');
    },
    canEdit() {
      return this.canManipulate && this.viewMode === 'fields';
    }
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

      let update = this.changes;
      let unset = {};
      const hasUnsetFields = Object.keys(this.changes)
        .some(key => this.changes[key] === undefined);
      if (hasUnsetFields) {
        unset = Object.keys(this.changes)
          .filter(key => this.changes[key] === undefined)
          .reduce((obj, key) => Object.assign(obj, { [key]: 1 }), {});
        update = Object.keys(this.changes)
          .filter(key => this.changes[key] !== undefined)
          .reduce((obj, key) => Object.assign(obj, { [key]: this.changes[key] }), {});
      }

      const { doc } = await api.Model.updateDocument({
        model: this.model,
        _id: this.document._id,
        update,
        unset
      });
      this.document = doc;
      this.changes = {};
      this.editting = false;
      this.shouldShowConfirmModal = false;
      this.$toast.success('Document saved!');
    },
    async remove() {
      const { doc } = await api.Model.deleteDocument({
        model: this.model,
        documentId: this.document._id
      });
      if (doc.acknowledged) {
        this.editting = false;
        this.document = {};
        this.$toast.success('Document deleted!');
        this.$router.push({
          path: `/model/${this.model}`,
          query: this.previousQuery || {}
        });
      }
    },
    showClonedDocument(doc) {
      this.$router.push({ path: `/model/${this.model}/document/${doc._id}` });
    },
    async addField(fieldData) {
      const { doc } = await api.Model.addField({
        model: this.model,
        _id: this.document._id,
        fieldName: fieldData.name,
        fieldValue: fieldData.value
      });
      this.document = doc;

      this.$toast.success(`Field added! Field "${fieldData.name}" has been added to the document`);
    },
    updateViewMode(mode) {
      this.viewMode = mode;
      // Exit edit mode when switching to JSON view
      if (mode === 'json' && this.editting) {
        this.editting = false;
        this.changes = {};
      }
    },
    copyDocument() {
      if (!this.document) {
        return;
      }

      const textToCopy = JSON.stringify(this.document, null, 2);
      const fallbackCopy = () => {
        if (typeof document === 'undefined') {
          return;
        }
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } finally {
          document.body.removeChild(textArea);
        }
        this.$toast.success('Document copied!');
      };

      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            this.$toast.success('Document copied!');
          })
          .catch(() => {
            fallbackCopy();
          });
      } else {
        fallbackCopy();
      }
    },
    goBack() {
      // Preserve query parameters when going back to models page
      this.$router.push({
        path: '/model/' + this.model,
        query: this.previousQuery || {}
      });
    }
  }
});
