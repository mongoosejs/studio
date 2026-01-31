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
    previousQuery: null,
    lastUpdatedAt: null,
    isRefreshing: false,
    autoRefreshEnabled: false,
    autoRefreshConnecting: false,
    autoRefreshLoopRunning: false,
    autoRefreshError: null,
    autoRefreshAbortController: null,
    autoRefreshRetryTimer: null,
    pendingRefresh: false
  }),
  async mounted() {
    window.pageState = this;
    // Store query parameters from the route (preserved from models page)
    this.previousQuery = Object.assign({}, this.$route.query);
    await this.refreshDocument({ force: true, source: 'initial' });
  },
  beforeDestroy() {
    this.stopAutoRefresh();
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
    lastUpdatedLabel() {
      if (!this.lastUpdatedAt) {
        return '—';
      }
      try {
        return new Date(this.lastUpdatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } catch (err) {
        return '—';
      }
    },
    canEdit() {
      return this.canManipulate && this.viewMode === 'fields';
    },
    isLambda() {
      return !!window?.MONGOOSE_STUDIO_CONFIG?.isLambda;
    }
  },
  watch: {
    editting(nextValue) {
      if (!nextValue && this.pendingRefresh) {
        this.refreshDocument({ source: 'pending' });
      }
    }
  },
  methods: {
    cancelEdit() {
      this.changes = {};
      this.editting = false;
    },
    async refreshDocument(options = {}) {
      const { force = false, source = 'manual' } = options;
      if (this.editting && !force) {
        this.pendingRefresh = true;
        return;
      }
      if (this.isRefreshing) {
        this.pendingRefresh = true;
        return;
      }

      const isInitial = this.status === 'init';
      if (isInitial) {
        this.status = 'loading';
      }
      this.isRefreshing = true;
      this.autoRefreshError = null;
      try {
        const { doc, schemaPaths, virtualPaths } = await api.Model.getDocument({
          model: this.model,
          documentId: this.documentId
        });
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
        this.lastUpdatedAt = new Date();
        this.pendingRefresh = false;
      } catch (err) {
        console.error('Error refreshing document:', err);
        if (this.$toast && source !== 'initial') {
          this.$toast.error('Failed to refresh document');
        }
      } finally {
        this.status = 'loaded';
        this.isRefreshing = false;
        if (this.pendingRefresh && !this.editting) {
          this.pendingRefresh = false;
          this.refreshDocument({ source: 'pending' });
        }
      }
    },
    toggleAutoRefresh() {
      if (this.autoRefreshEnabled) {
        this.stopAutoRefresh();
      } else {
        this.startAutoRefresh();
      }
    },
    startAutoRefresh() {
      if (this.autoRefreshEnabled) {
        return;
      }
      this.autoRefreshEnabled = true;
      this.autoRefreshError = null;
      this.runAutoRefreshLoop();
    },
    stopAutoRefresh() {
      this.autoRefreshEnabled = false;
      this.autoRefreshConnecting = false;
      if (this.autoRefreshAbortController) {
        this.autoRefreshAbortController.abort();
        this.autoRefreshAbortController = null;
      }
      if (this.autoRefreshRetryTimer) {
        clearTimeout(this.autoRefreshRetryTimer);
        this.autoRefreshRetryTimer = null;
      }
    },
    async runAutoRefreshLoop() {
      if (this.autoRefreshLoopRunning) {
        return;
      }
      this.autoRefreshLoopRunning = true;
      this.autoRefreshAbortController = new AbortController();
      let retryDelay = 1500;

      while (this.autoRefreshEnabled && !this.autoRefreshAbortController.signal.aborted) {
        try {
          this.autoRefreshConnecting = true;
          for await (const event of api.Model.streamDocumentChanges({
            model: this.model,
            documentId: this.documentId
          }, { signal: this.autoRefreshAbortController.signal })) {
            this.autoRefreshConnecting = false;
            if (!event || event.type === 'heartbeat') {
              continue;
            }
            await this.refreshDocument({ source: 'auto' });
          }
        } catch (err) {
          if (this.autoRefreshAbortController.signal.aborted) {
            break;
          }
          this.autoRefreshError = err?.message || String(err);
        } finally {
          this.autoRefreshConnecting = false;
        }

        if (!this.autoRefreshEnabled || this.autoRefreshAbortController.signal.aborted) {
          break;
        }

        await new Promise(resolve => {
          this.autoRefreshRetryTimer = setTimeout(resolve, retryDelay);
        });
        retryDelay = Math.min(retryDelay * 2, 15000);
      }

      this.autoRefreshLoopRunning = false;
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
    goBack() {
      // Preserve query parameters when going back to models page
      this.$router.push({
        path: '/model/' + this.model,
        query: this.previousQuery || {}
      });
    }
  }
});
