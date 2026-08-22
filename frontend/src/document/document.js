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
    shouldShowValidationModal: false,
    showAddFieldModal: false,
    validationResult: null,
    fieldData: {
      name: '',
      type: '',
      value: ''
    },
    fieldErrors: {},
    isSubmittingField: false,
    previousQuery: null,
    lastUpdatedAt: null,
    isRefreshing: false,
    autoRefreshEnabled: false,
    autoRefreshConnecting: false,
    autoRefreshLoopRunning: false,
    autoRefreshError: null,
    autoRefreshAbortController: null,
    autoRefreshRetryTimer: null,
    pendingRefresh: false,
    scriptDrawerOpen: false
  }),
  async mounted() {
    window.pageState = this;
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', this.handleSaveShortcut);
    }
    // Store query parameters from the route (preserved from models page)
    this.previousQuery = Object.assign({}, this.$route.query);
    await this.refreshDocument({ force: true, source: 'initial' });
  },
  beforeUnmount() {
    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('keydown', this.handleSaveShortcut);
    }
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
    keyboardShortcuts() {
      const shortcuts = [];
      if (this.editting && this.canManipulate) {
        shortcuts.push({ command: 'Ctrl + S', description: 'Save document' });
      }
      return shortcuts;
    },
    allFieldTypes() {
      const types = new Set(['String', 'Number', 'Boolean', 'Date', 'Array', 'Object']);

      (this.schemaPaths || []).forEach(path => {
        if (path.instance) {
          types.add(path.instance);
        }
      });

      Object.keys(this.document || {}).forEach(key => {
        if ((this.schemaPaths || []).some(path => path.path === key)) {
          return;
        }
        const fieldType = this.getFieldType(this.document[key]);
        if (fieldType && fieldType !== 'unknown' && fieldType !== 'null') {
          types.add(fieldType);
        }
      });

      return Array.from(types).sort();
    },
    shouldUseAce() {
      return ['Array', 'Object', 'Embedded'].includes(this.fieldData.type);
    },
    shouldUseDatePicker() {
      return this.fieldData.type === 'Date';
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
    handleSaveShortcut(event) {
      const key = typeof event?.key === 'string' ? event.key.toLowerCase() : '';
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && key === 's';
      if (!isSaveShortcut) {
        return;
      }
      if (!this.editting || !this.canManipulate) {
        return;
      }

      event.preventDefault();
      this.shouldShowConfirmModal = true;
    },
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
    addField() {
      this.showAddFieldModal = true;
    },
    closeAddFieldModal() {
      this.showAddFieldModal = false;
      this.resetFieldForm();
    },
    resetFieldForm() {
      this.fieldData = {
        name: '',
        type: '',
        value: ''
      };
      this.fieldErrors = {};
      this.isSubmittingField = false;
    },
    getTransformedFieldName() {
      const trimmedName = this.fieldData.name.trim();
      return trimmedName
        .replace(/[^a-zA-Z0-9_$]/g, '_')
        .replace(/^[^a-zA-Z_$]+/, '');
    },
    validateFieldForm() {
      this.fieldErrors = {};

      const trimmedName = this.fieldData.name.trim();
      if (!trimmedName) {
        this.fieldErrors.name = 'Field name is required';
      } else {
        const transformedName = this.getTransformedFieldName();
        if (!transformedName) {
          this.fieldErrors.name = 'Field name contains only invalid characters';
        } else if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(transformedName)) {
          this.fieldErrors.name = 'Field name must start with a letter, underscore, or $ and contain only letters, numbers, underscores, and $';
        }
      }

      if (!this.fieldData.type) {
        this.fieldErrors.type = 'Field type is required';
      }

      if (this.fieldData.value && this.fieldData.value.trim()) {
        if (['Object', 'Array'].includes(this.fieldData.type)) {
          try {
            JSON.parse(this.fieldData.value);
          } catch (err) {
            this.fieldErrors.value = 'Invalid JSON format for object/array type';
          }
        } else if (this.fieldData.type === 'Number') {
          if (isNaN(Number(this.fieldData.value))) {
            this.fieldErrors.value = 'Invalid number format';
          }
        } else if (this.fieldData.type === 'Boolean') {
          const lowerValue = this.fieldData.value.toLowerCase();
          if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lowerValue)) {
            this.fieldErrors.value = 'Invalid boolean value (use true/false, 1/0, yes/no)';
          }
        } else if (this.fieldData.type === 'Date') {
          const dateValue = new Date(this.fieldData.value);
          if (isNaN(dateValue.getTime())) {
            this.fieldErrors.value = 'Invalid date format';
          }
        }
      }

      return Object.keys(this.fieldErrors).length === 0;
    },
    parseFieldValue(value, type) {
      if (!value || !value.trim()) {
        return null;
      }

      switch (type) {
        case 'Number':
          return Number(value);
        case 'Boolean':
          return ['true', '1', 'yes'].includes(value.toLowerCase());
        case 'Date':
          return new Date(value);
        case 'Object':
        case 'Array':
          return JSON.parse(value);
        default:
          return value;
      }
    },
    async handleAddFieldSubmit() {
      if (!this.validateFieldForm()) {
        return;
      }

      this.isSubmittingField = true;

      try {
        const fieldName = this.getTransformedFieldName();
        const fieldValue = this.parseFieldValue(this.fieldData.value, this.fieldData.type);

        const { doc } = await api.Model.addField({
          model: this.model,
          _id: this.document._id,
          fieldName,
          fieldValue
        });
        this.document = doc;
        this.closeAddFieldModal();

        this.$toast.success(`Field added! Field "${fieldName}" has been added to the document`);
      } catch (error) {
        console.error('Error adding field:', error);
        this.fieldErrors.value = 'Error adding field';
      } finally {
        this.isSubmittingField = false;
      }
    },
    getFieldType(value) {
      if (value === null || value === undefined) {
        return 'null';
      }
      if (Array.isArray(value)) {
        return 'Array';
      }
      if (value instanceof Date) {
        return 'Date';
      }
      if (typeof value === 'object') {
        return 'Object';
      }
      if (typeof value === 'number') {
        return 'Number';
      }
      if (typeof value === 'boolean') {
        return 'Boolean';
      }
      if (typeof value === 'string') {
        return 'String';
      }
      return 'unknown';
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
    },
    openScriptDrawer() {
      this.scriptDrawerOpen = true;
      this.desktopMenuOpen = false;
      this.mobileMenuOpen = false;
    },
    async openValidationModal() {
      this.desktopMenuOpen = false;
      this.mobileMenuOpen = false;
      this.shouldShowValidationModal = true;
      this.validationResult = null;
      const { result } = await api.Model.validateDocument({
        model: this.model,
        documentId: this.documentId
      });
      this.validationResult = result;
    },
    closeScriptDrawer() {
      this.scriptDrawerOpen = false;
    },
    handleScriptRefresh() {
      this.refreshDocument({ force: true, source: 'script' });
    }
  }
});
