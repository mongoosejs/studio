'use strict';

/* global L */

const api = require('../api');
const template = require('./models.html');
const mpath = require('mpath');
const xss = require('xss');

const appendCSS = require('../appendCSS');
appendCSS(require('./models.css'));

const limit = 20;
const OUTPUT_TYPE_STORAGE_KEY = 'studio:model-output-type';
const SELECTED_GEO_FIELD_STORAGE_KEY = 'studio:model-selected-geo-field';
const PROJECTION_STORAGE_KEY_PREFIX = 'studio:model-projection:';

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
    shouldShowExportModal: false,
    shouldShowCreateModal: false,
    projectionText: '',
    showAddFieldDropdown: false,
    shouldShowIndexModal: false,
    shouldShowCollectionInfoModal: false,
    shouldShowUpdateMultipleModal: false,
    shouldShowDeleteMultipleModal: false,
    shouldExport: {},
    sortBy: {},
    query: {},
    scrollHeight: 0,
    interval: null,
    outputType: 'table', // json, table, map
    selectedGeoField: null,
    mapInstance: null,
    mapLayer: null,
    hideSidebar: null,
    lastSelectedIndex: null,
    error: null,
    showActionsMenu: false,
    collectionInfo: null
  }),
  created() {
    this.currentModel = this.model;
    this.loadOutputPreference();
    this.loadSelectedGeoField();
  },
  beforeDestroy() {
    document.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('popstate', this.onPopState, true);
    document.removeEventListener('click', this.onOutsideActionsMenuClick, true);
    document.removeEventListener('click', this.onOutsideAddFieldDropdownClick, true);
    this.destroyMap();
  },
  async mounted() {
    this.onScroll = () => this.checkIfScrolledToBottom();
    document.addEventListener('scroll', this.onScroll, true);
    this.onPopState = () => this.initSearchFromUrl();
    window.addEventListener('popstate', this.onPopState, true);
    this.onOutsideActionsMenuClick = event => {
      if (!this.showActionsMenu) {
        return;
      }
      const actionsMenu = this.$refs.actionsMenuContainer;
      if (actionsMenu && !actionsMenu.contains(event.target)) {
        this.closeActionsMenu();
      }
    };
    this.onOutsideAddFieldDropdownClick = event => {
      if (!this.showAddFieldDropdown) {
        return;
      }
      const container = this.$refs.addFieldContainer;
      if (container && !container.contains(event.target)) {
        this.showAddFieldDropdown = false;
      }
    };
    document.addEventListener('click', this.onOutsideActionsMenuClick, true);
    document.addEventListener('click', this.onOutsideAddFieldDropdownClick, true);
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
  watch: {
    model(newModel) {
      if (newModel !== this.currentModel) {
        this.currentModel = newModel;
        if (this.currentModel != null) {
          this.initSearchFromUrl();
        }
      }
    },
    documents: {
      handler() {
        if (this.outputType === 'map' && this.mapInstance) {
          this.$nextTick(() => {
            this.updateMapFeatures();
          });
        }
      },
      deep: true
    },
    geoJsonFields: {
      handler(newFields) {
        // Switch off map view if map is selected but no GeoJSON fields available
        if (this.outputType === 'map' && newFields.length === 0) {
          this.setOutputType('json');
          return;
        }
        // Auto-select first field if current selection is not valid
        if (this.outputType === 'map' && newFields.length > 0) {
          const isCurrentValid = newFields.some(f => f.path === this.selectedGeoField);
          if (!isCurrentValid) {
            this.selectedGeoField = newFields[0].path;
            this.$nextTick(() => {
              this.updateMapFeatures();
            });
          }
        }
      }
    }
  },
  computed: {
    referenceMap() {
      const map = {};
      for (const path of this.filteredPaths) {
        if (path?.ref) {
          map[path.path] = path.ref;
        }
      }
      return map;
    },
    geoJsonFields() {
      // Find schema paths that look like GeoJSON fields
      // GeoJSON fields have nested 'type' and 'coordinates' properties
      const geoFields = [];
      const pathsByPrefix = {};

      // Group paths by their parent prefix
      for (const schemaPath of this.schemaPaths) {
        const path = schemaPath.path;
        const parts = path.split('.');
        if (parts.length >= 2) {
          const parent = parts.slice(0, -1).join('.');
          const child = parts[parts.length - 1];
          if (!pathsByPrefix[parent]) {
            pathsByPrefix[parent] = {};
          }
          pathsByPrefix[parent][child] = schemaPath;
        }
      }

      // Check which parents have both 'type' and 'coordinates' children
      for (const [parent, children] of Object.entries(pathsByPrefix)) {
        if (children.type && children.coordinates) {
          geoFields.push({
            path: parent,
            label: parent
          });
        }
      }

      // Also check for Embedded/Mixed fields that might contain GeoJSON
      // by looking at actual document data
      for (const schemaPath of this.schemaPaths) {
        if (schemaPath.instance === 'Embedded' || schemaPath.instance === 'Mixed') {
          // Check if any document has this field with GeoJSON structure
          const hasGeoJsonData = this.documents.some(doc => {
            const value = mpath.get(schemaPath.path, doc);
            return this.isGeoJsonValue(value);
          });
          if (hasGeoJsonData && !geoFields.find(f => f.path === schemaPath.path)) {
            geoFields.push({
              path: schemaPath.path,
              label: schemaPath.path
            });
          }
        }
      }

      return geoFields;
    },
    availablePathsToAdd() {
      const currentPaths = new Set(this.filteredPaths.map(p => p.path));
      return this.schemaPaths.filter(p => !currentPaths.has(p.path));
    }
  },
  methods: {
    loadOutputPreference() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      const storedPreference = window.localStorage.getItem(OUTPUT_TYPE_STORAGE_KEY);
      if (storedPreference === 'json' || storedPreference === 'table' || storedPreference === 'map') {
        this.outputType = storedPreference;
      }
    },
    loadSelectedGeoField() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      const storedField = window.localStorage.getItem(SELECTED_GEO_FIELD_STORAGE_KEY);
      if (storedField) {
        this.selectedGeoField = storedField;
      }
    },
    setOutputType(type) {
      if (type !== 'json' && type !== 'table' && type !== 'map') {
        return;
      }
      this.outputType = type;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(OUTPUT_TYPE_STORAGE_KEY, type);
      }
      if (type === 'map') {
        this.$nextTick(() => {
          this.initMap();
        });
      } else {
        this.destroyMap();
      }
    },
    setSelectedGeoField(field) {
      this.selectedGeoField = field;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SELECTED_GEO_FIELD_STORAGE_KEY, field);
      }
      if (this.outputType === 'map') {
        this.$nextTick(() => {
          this.updateMapFeatures();
        });
      }
    },
    isGeoJsonValue(value) {
      return value != null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.prototype.hasOwnProperty.call(value, 'type') &&
        typeof value.type === 'string' &&
        Object.prototype.hasOwnProperty.call(value, 'coordinates') &&
        Array.isArray(value.coordinates);
    },
    initMap() {
      if (typeof L === 'undefined') {
        console.error('Leaflet (L) is not defined');
        return;
      }
      if (!this.$refs.modelsMap) {
        return;
      }
      if (this.mapInstance) {
        this.updateMapFeatures();
        return;
      }

      const mapElement = this.$refs.modelsMap;
      mapElement.style.setProperty('height', '100%', 'important');
      mapElement.style.setProperty('min-height', '400px', 'important');
      mapElement.style.setProperty('width', '100%', 'important');

      this.mapInstance = L.map(this.$refs.modelsMap).setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.mapInstance);

      this.$nextTick(() => {
        if (this.mapInstance) {
          this.mapInstance.invalidateSize();
          this.updateMapFeatures();
        }
      });
    },
    destroyMap() {
      if (this.mapLayer) {
        this.mapLayer.remove();
        this.mapLayer = null;
      }
      if (this.mapInstance) {
        this.mapInstance.remove();
        this.mapInstance = null;
      }
    },
    updateMapFeatures() {
      if (!this.mapInstance) {
        return;
      }

      // Remove existing layer
      if (this.mapLayer) {
        this.mapLayer.remove();
        this.mapLayer = null;
      }

      // Auto-select first geoJSON field if none selected
      if (!this.selectedGeoField && this.geoJsonFields.length > 0) {
        this.selectedGeoField = this.geoJsonFields[0].path;
      }

      if (!this.selectedGeoField) {
        return;
      }

      // Build GeoJSON FeatureCollection from documents
      const features = [];
      for (const doc of this.documents) {
        const geoValue = mpath.get(this.selectedGeoField, doc);
        if (this.isGeoJsonValue(geoValue)) {
          features.push({
            type: 'Feature',
            geometry: geoValue,
            properties: {
              _id: doc._id,
              documentId: doc._id
            }
          });
        }
      }

      if (features.length === 0) {
        return;
      }

      const featureCollection = {
        type: 'FeatureCollection',
        features: features
      };

      // Add layer with click handler for popups
      this.mapLayer = L.geoJSON(featureCollection, {
        style: {
          color: '#3388ff',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.3
        },
        pointToLayer: (feature, latlng) => {
          return L.marker(latlng);
        },
        onEachFeature: (feature, layer) => {
          const docId = feature.properties._id;
          const docUrl = `#/model/${this.currentModel}/document/${xss(docId)}`;
          const popupContent = `
            <div style="min-width: 150px;">
              <div style="font-weight: bold; margin-bottom: 8px;">Document</div>
              <div style="font-family: monospace; font-size: 12px; word-break: break-all; margin-bottom: 8px;">${docId}</div>
              <a href="${docUrl}" style="color: #3388ff; text-decoration: underline;">Open Document</a>
            </div>
          `;
          layer.bindPopup(popupContent);
        }
      }).addTo(this.mapInstance);

      // Fit bounds to show all features
      const bounds = this.mapLayer.getBounds();
      if (bounds.isValid()) {
        this.mapInstance.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 });
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
        const urlPaths = this.$route.query.fields.split(',').map(s => s.trim()).filter(Boolean);
        if (urlPaths.length > 0) {
          this.filteredPaths = urlPaths.map(path => this.schemaPaths.find(p => p.path === path)).filter(Boolean);
          if (this.filteredPaths.length > 0) {
            this.syncProjectionFromPaths();
            this.saveProjectionPreference();
          }
        }
      }
      this.status = 'loaded';

      // Initialize map if output type is map
      if (this.outputType === 'map') {
        this.$nextTick(() => {
          this.initMap();
        });
      }
    },
    async dropIndex(name) {
      const { mongoDBIndexes } = await api.Model.dropIndex({ model: this.currentModel, name });
      this.mongoDBIndexes = mongoDBIndexes;
      this.$toast.success('Index dropped!');
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
      for (let i = 0; i < this.filteredPaths.length; i++) {
        const path = this.filteredPaths[i].path;
        const value = mpath.get(path, doc);
        mpath.set(path, value, filteredDoc);
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
      this.documents = [];
      this.loadedAllDocs = false;
      await this.loadMoreDocuments();
    },
    async search(searchText) {
      this.searchText = searchText;
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
    addPathFilter(path) {
      if (this.$refs.documentSearch?.addPathFilter) {
        this.$refs.documentSearch.addPathFilter(path);
      }
    },
    async openIndexModal() {
      this.closeActionsMenu();
      this.shouldShowIndexModal = true;
      const { mongoDBIndexes, schemaIndexes } = await api.Model.getIndexes({ model: this.currentModel });
      this.mongoDBIndexes = mongoDBIndexes;
      this.schemaIndexes = schemaIndexes;
    },
    toggleActionsMenu() {
      this.showActionsMenu = !this.showActionsMenu;
    },
    closeActionsMenu() {
      this.showActionsMenu = false;
    },
    async openCollectionInfo() {
      this.closeActionsMenu();
      this.shouldShowCollectionInfoModal = true;
      this.collectionInfo = null;
      const { info } = await api.Model.getCollectionInfo({ model: this.currentModel });
      this.collectionInfo = info;
    },
    async findOldestDocument() {
      this.closeActionsMenu();
      const { docs } = await api.Model.getDocuments({
        model: this.currentModel,
        limit: 1,
        sortKey: '_id',
        sortDirection: 1
      });
      if (!Array.isArray(docs) || docs.length === 0) {
        throw new Error('No documents found');
      }
      this.openDocument(docs[0]);
    },
    isTTLIndex(index) {
      return index != null && index.expireAfterSeconds != null;
    },
    formatTTL(expireAfterSeconds) {
      if (typeof expireAfterSeconds !== 'number') {
        return '';
      }

      let remaining = expireAfterSeconds;
      const days = Math.floor(remaining / (24 * 60 * 60));
      remaining = remaining % (24 * 60 * 60);
      const hours = Math.floor(remaining / (60 * 60));
      remaining = remaining % (60 * 60);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;

      const parts = [];
      if (days > 0) {
        parts.push(`${days} day${days === 1 ? '' : 's'}`);
      }
      if (hours > 0) {
        parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
      }
      if (minutes > 0) {
        parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
      }
      if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
      }

      return parts.join(', ');
    },
    formatCollectionSize(size) {
      if (typeof size !== 'number') {
        return 'Unknown';
      }

      const KB = 1024;
      const MB = KB * 1024;
      const GB = MB * 1024;
      const TB = GB * 1024;

      if (size >= TB) {
        return `${(size / TB).toFixed(3)} TB`;
      } else if (size >= GB) {
        return `${(size / GB).toFixed(3)} GB`;
      } else if (size >= MB) {
        return `${(size / MB).toFixed(3)} MB`;
      } else if (size >= KB) {
        return `${(size / KB).toFixed(3)} KB`;
      } else {
        return `${size.toLocaleString()} bytes`;
      }
    },
    formatNumber(value) {
      if (typeof value !== 'number') {
        return 'Unknown';
      }

      return value.toLocaleString();
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
          const savedPaths = this.loadProjectionPreference();
          if (savedPaths && savedPaths.length > 0) {
            this.filteredPaths = savedPaths.map(path => this.schemaPaths.find(p => p.path === path)).filter(Boolean);
            if (this.filteredPaths.length === 0) {
              this.filteredPaths = this.schemaPaths.filter(p => p.path === '_id');
            }
          } else {
            this.filteredPaths = this.schemaPaths.filter(p => p.path === '_id');
          }
          this.selectedPaths = [...this.filteredPaths];
          this.syncProjectionFromPaths();
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
    loadProjectionPreference() {
      if (typeof window === 'undefined' || !window.localStorage || !this.currentModel) {
        return null;
      }
      const key = PROJECTION_STORAGE_KEY_PREFIX + this.currentModel;
      const stored = window.localStorage.getItem(key);
      if (stored) {
        try {
          const paths = stored.split(',').map(s => s.trim()).filter(Boolean);
          return paths.length > 0 ? paths : null;
        } catch (e) {
          return null;
        }
      }
      return null;
    },
    saveProjectionPreference() {
      if (typeof window === 'undefined' || !window.localStorage || !this.currentModel) {
        return;
      }
      const key = PROJECTION_STORAGE_KEY_PREFIX + this.currentModel;
      const paths = this.filteredPaths.map(p => p.path).join(',');
      window.localStorage.setItem(key, paths);
    },
    addAllFields() {
      this.filteredPaths = [...this.schemaPaths].sort((a, b) => {
        if (a.path === '_id') return -1;
        if (b.path === '_id') return 1;
        return 0;
      });
      this.selectedPaths = [...this.filteredPaths];
      this.syncProjectionFromPaths();
      this.updateProjectionQuery();
      this.saveProjectionPreference();
    },
    resetProjection() {
      const idPath = this.schemaPaths.find(p => p.path === '_id');
      this.filteredPaths = idPath ? [idPath] : (this.schemaPaths.length > 0 ? [this.schemaPaths[0]] : []);
      this.selectedPaths = [...this.filteredPaths];
      this.syncProjectionFromPaths();
      this.updateProjectionQuery();
      this.saveProjectionPreference();
    },
    initProjection(ev) {
      if (!this.projectionText || !this.projectionText.trim()) {
        this.projectionText = '{}';
        this.$nextTick(() => {
          if (ev && ev.target) {
            ev.target.setSelectionRange(1, 1);
          }
        });
      }
    },
    syncProjectionFromPaths() {
      if (this.filteredPaths.length === 0) {
        this.projectionText = '{}';
        return;
      }
      this.projectionText = '{ ' + this.filteredPaths.map(p => p.path + ': 1').join(', ') + ' }';
    },
    parseProjectionInput(text) {
      if (!text || typeof text !== 'string') {
        return [];
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return [];
      }
      let paths = [];
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const obj = eval('(' + trimmed + ')');
          const inclusionKeys = Object.keys(obj).filter(k => obj[k]);
          const exclusionKeys = Object.keys(obj).filter(k => !obj[k]);
          if (exclusionKeys.length > 0 && inclusionKeys.length === 0) {
            const excludeSet = new Set(exclusionKeys);
            paths = this.schemaPaths.map(p => p.path).filter(p => !excludeSet.has(p));
          } else {
            paths = inclusionKeys;
          }
        } catch (e) {
          return null;
        }
      } else {
        paths = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
      return paths;
    },
    applyProjectionFromInput() {
      const paths = this.parseProjectionInput(this.projectionText);
      if (paths === null) {
        this.syncProjectionFromPaths();
        return;
      }
      if (paths.length === 0) {
        this.filteredPaths = this.schemaPaths.filter(p => p.path === '_id');
        if (this.filteredPaths.length === 0 && this.schemaPaths.length > 0) {
          const idPath = this.schemaPaths.find(p => p.path === '_id');
          this.filteredPaths = idPath ? [idPath] : [this.schemaPaths[0]];
        }
      } else {
        this.filteredPaths = paths.map(path => this.schemaPaths.find(p => p.path === path)).filter(Boolean);
        const validPaths = new Set(this.schemaPaths.map(p => p.path));
        for (const path of paths) {
          if (validPaths.has(path) && !this.filteredPaths.find(p => p.path === path)) {
            this.filteredPaths.push(this.schemaPaths.find(p => p.path === path));
          }
        }
        if (this.filteredPaths.length === 0) {
          this.filteredPaths = this.schemaPaths.filter(p => p.path === '_id');
        }
      }
      this.selectedPaths = [...this.filteredPaths];
      this.syncProjectionFromPaths();
      this.updateProjectionQuery();
      this.saveProjectionPreference();
    },
    updateProjectionQuery() {
      const selectedParams = this.filteredPaths.map(x => x.path).join(',');
      if (selectedParams) {
        this.query.fields = selectedParams;
      } else {
        delete this.query.fields;
      }
      this.$router.push({ query: this.query });
    },
    removeField(schemaPath) {
      const index = this.filteredPaths.findIndex(p => p.path === schemaPath.path);
      if (index !== -1) {
        this.filteredPaths.splice(index, 1);
        if (this.filteredPaths.length === 0) {
          const idPath = this.schemaPaths.find(p => p.path === '_id');
          this.filteredPaths = idPath ? [idPath] : [];
        }
        this.syncProjectionFromPaths();
        this.updateProjectionQuery();
        this.saveProjectionPreference();
      }
    },
    addField(schemaPath) {
      if (!this.filteredPaths.find(p => p.path === schemaPath.path)) {
        this.filteredPaths.push(schemaPath);
        this.filteredPaths.sort((a, b) => {
          if (a.path === '_id') return -1;
          if (b.path === '_id') return 1;
          return 0;
        });
        this.syncProjectionFromPaths();
        this.updateProjectionQuery();
        this.saveProjectionPreference();
        this.showAddFieldDropdown = false;
      }
    },
    toggleAddFieldDropdown() {
      this.showAddFieldDropdown = !this.showAddFieldDropdown;
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
      this.$toast.success('Document updated!');
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
      this.$router.push({
        path: '/model/' + this.currentModel + '/document/' + document._id,
        query: this.$route.query
      });
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
      this.$toast.success('Documents deleted!');
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
