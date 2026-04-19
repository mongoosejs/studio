'use strict';

/* global L */

const api = require('../api');
const template = require('./models.html');
const mpath = require('mpath');
const xss = require('xss');

const appendCSS = require('../appendCSS');
appendCSS(require('./models.css'));

const limit = 20;
const DEFAULT_FIRST_N_FIELDS = 6;
const OUTPUT_TYPE_STORAGE_KEY = 'studio:model-output-type';
const SELECTED_GEO_FIELD_STORAGE_KEY = 'studio:model-selected-geo-field';
const SHOW_ROW_NUMBERS_STORAGE_KEY = 'studio:model-show-row-numbers';
const QUERY_TIMEOUT_SECONDS_STORAGE_KEY = 'studio:model-query-timeout-seconds';
const PROJECTION_MODE_QUERY_KEY = 'projectionMode';
const RECENTLY_VIEWED_MODELS_KEY = 'studio:recently-viewed-models';
const MAX_RECENT_MODELS = 4;
const DEFAULT_QUERY_TIMEOUT_SECONDS = 10;

/** Parse `fields` from the route (JSON array or inclusion projection object only). */
function parseFieldsQueryParam(fields) {
  if (fields == null || fields === '') {
    return [];
  }
  const s = typeof fields === 'string' ? fields : String(fields);
  const trimmed = s.trim();
  if (!trimmed) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed.map(x => String(x).trim()).filter(Boolean);
  }
  if (parsed != null && typeof parsed === 'object') {
    return Object.keys(parsed).filter(k =>
      Object.prototype.hasOwnProperty.call(parsed, k) && parsed[k]
    );
  }
  return [];
}

/** Pass through a valid JSON `fields` string for Model.getDocuments / getDocumentsStream. */
function normalizeFieldsParamForApi(fieldsStr) {
  if (fieldsStr == null || fieldsStr === '') {
    return null;
  }
  const s = typeof fieldsStr === 'string' ? fieldsStr : String(fieldsStr);
  const trimmed = s.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return trimmed;
    }
    if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return trimmed;
    }
  } catch (e) {
    return null;
  }
  return null;
}

module.exports = app => app.component('models', {
  template: template,
  props: ['model', 'user', 'roles'],
  data: () => ({
    models: [],
    currentModel: null,
    modelDocumentCounts: {},
    documents: [],
    schemaPaths: [],
    filteredPaths: [],
    selectedPaths: [],
    numDocuments: null,
    mongoDBIndexes: [],
    schemaIndexes: [],
    status: 'loading',
    loadingMore: false,
    loadedAllDocs: false,
    edittingDoc: null,
    docEdits: null,
    selectMultiple: false,
    selectedDocuments: [],
    searchText: '',
    shouldShowExportModal: false,
    shouldShowCreateModal: false,
    projectionText: '',
    isProjectionMenuSelected: false,
    addFieldFilterText: '',
    showAddFieldDropdown: false,
    shouldShowIndexModal: false,
    shouldShowCollectionInfoModal: false,
    shouldShowUpdateMultipleModal: false,
    shouldShowDeleteMultipleModal: false,
    shouldShowQueryTimeoutModal: false,
    shouldExport: {},
    sortBy: {},
    query: {},
    scrollHeight: 0,
    interval: null,
    outputType: 'table', // json, table, map
    selectedGeoField: null,
    mapInstance: null,
    mapLayer: null,
    mapTileLayer: null,
    hideSidebar: null,
    lastSelectedIndex: null,
    error: null,
    showActionsMenu: false,
    collectionInfo: null,
    modelSearch: '',
    recentlyViewedModels: [],
    showModelSwitcher: false,
    showRowNumbers: true,
    queryTimeoutSeconds: DEFAULT_QUERY_TIMEOUT_SECONDS,
    queryTimeoutDraftSeconds: String(DEFAULT_QUERY_TIMEOUT_SECONDS),
    suppressScrollCheck: false,
    scrollTopToRestore: null
  }),
  created() {
    this.currentModel = this.model;
    this.setSearchTextFromRoute();
    this.loadOutputPreference();
    this.loadSelectedGeoField();
    this.loadShowRowNumbersPreference();
    this.loadQueryTimeoutPreference();
    this.loadRecentlyViewedModels();
    this.isProjectionMenuSelected = this.$route?.query?.[PROJECTION_MODE_QUERY_KEY] === '1';
  },
  beforeDestroy() {
    window.removeEventListener('popstate', this.onPopState, true);
    document.removeEventListener('click', this.onOutsideActionsMenuClick, true);
    document.removeEventListener('click', this.onOutsideAddFieldDropdownClick, true);
    document.documentElement.removeEventListener('studio-theme-changed', this.onStudioThemeChanged);
    document.removeEventListener('keydown', this.onCtrlP, true);
    this.destroyMap();
  },
  async mounted() {
    // Persist scroll restoration across remounts.
    // This component is keyed by `$route.fullPath`, so query changes (e.g. projection updates)
    // recreate the component and reset scroll position.
    if (typeof window !== 'undefined') {
      if (typeof window.__studioModelsScrollTopToRestore === 'number') {
        this.scrollTopToRestore = window.__studioModelsScrollTopToRestore;
      }
      if (window.__studioModelsSuppressScrollCheck === true) {
        this.suppressScrollCheck = true;
      }
      delete window.__studioModelsScrollTopToRestore;
      delete window.__studioModelsSuppressScrollCheck;
    }

    window.pageState = this;
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
        this.addFieldFilterText = '';
      }
    };
    document.addEventListener('click', this.onOutsideActionsMenuClick, true);
    document.addEventListener('click', this.onOutsideAddFieldDropdownClick, true);
    this.onStudioThemeChanged = () => this.updateMapTileLayer();
    document.documentElement.addEventListener('studio-theme-changed', this.onStudioThemeChanged);
    this.onCtrlP = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        this.openModelSwitcher();
      }
    };
    document.addEventListener('keydown', this.onCtrlP, true);
    this.query = Object.assign({}, this.$route.query);
    // Keep UI mode in sync with the URL on remounts.
    this.isProjectionMenuSelected = this.$route?.query?.[PROJECTION_MODE_QUERY_KEY] === '1';
    const { models, readyState } = await api.Model.listModels();
    this.models = models;
    await this.loadModelCounts();
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
    if (this.isProjectionMenuSelected && this.outputType === 'map') {
      // Projection input is not rendered in map view.
      this.setOutputType('json');
    }
    this.$nextTick(() => {
      if (!this.isProjectionMenuSelected) return;
      const input = this.$refs.projectionInput;
      if (input && typeof input.focus === 'function') {
        input.focus();
      }
    });
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
      for (const path of this.schemaPaths) {
        if (path?.ref) {
          map[path.path] = path.ref;
        }
      }
      return map;
    },
    filteredModels() {
      if (!this.modelSearch.trim()) {
        return this.models;
      }
      const search = this.modelSearch.trim().toLowerCase();
      return this.models.filter(m => m.toLowerCase().includes(search));
    },
    filteredRecentModels() {
      const recent = this.recentlyViewedModels.filter(m => this.models.includes(m));
      if (!this.modelSearch.trim()) {
        return recent;
      }
      const search = this.modelSearch.trim().toLowerCase();
      return recent.filter(m => m.toLowerCase().includes(search));
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
    },
    filteredPathsToAdd() {
      const available = this.availablePathsToAdd;
      const query = (this.addFieldFilterText || '').trim().toLowerCase();
      if (!query) return available;
      return available.filter(p => p.path.toLowerCase().includes(query));
    },
    tableDisplayPaths() {
      return this.filteredPaths.length > 0 ? this.filteredPaths : this.schemaPaths;
    }
  },
  methods: {
    highlightMatch(model) {
      const search = this.modelSearch.trim();
      if (!search) {
        return model;
      }
      const idx = model.toLowerCase().indexOf(search.toLowerCase());
      if (idx === -1) {
        return model;
      }
      const before = model.slice(0, idx);
      const match = model.slice(idx, idx + search.length);
      const after = model.slice(idx + search.length);
      return `${xss(before)}<strong>${xss(match)}</strong>${xss(after)}`;
    },
    loadRecentlyViewedModels() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      try {
        const stored = window.localStorage.getItem(RECENTLY_VIEWED_MODELS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.recentlyViewedModels = parsed.map(item => String(item)).slice(0, MAX_RECENT_MODELS);
          } else {
            this.recentlyViewedModels = [];
          }
        }
      } catch (err) {
        this.recentlyViewedModels = [];
      }
    },
    trackRecentModel(model) {
      if (!model) {
        return;
      }
      const filtered = this.recentlyViewedModels.filter(m => m !== model);
      filtered.unshift(model);
      this.recentlyViewedModels = filtered.slice(0, MAX_RECENT_MODELS);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(RECENTLY_VIEWED_MODELS_KEY, JSON.stringify(this.recentlyViewedModels));
      }
    },
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
    loadShowRowNumbersPreference() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      const stored = window.localStorage.getItem(SHOW_ROW_NUMBERS_STORAGE_KEY);
      if (stored === '0') {
        this.showRowNumbers = false;
      } else if (stored === '1') {
        this.showRowNumbers = true;
      }
    },
    toggleRowNumbers() {
      this.showRowNumbers = !this.showRowNumbers;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SHOW_ROW_NUMBERS_STORAGE_KEY, this.showRowNumbers ? '1' : '0');
      }
      this.showActionsMenu = false;
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
      this.updateMapTileLayer();

      this.$nextTick(() => {
        if (this.mapInstance) {
          this.mapInstance.invalidateSize();
          this.updateMapFeatures();
        }
      });
    },
    getMapTileLayerOptions() {
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      return isDark
        ? { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>', subdomains: 'abcd', maxZoom: 20 }
        : { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' };
    },
    updateMapTileLayer() {
      if (!this.mapInstance || typeof L === 'undefined') return;
      if (this.mapTileLayer) {
        this.mapTileLayer.remove();
        this.mapTileLayer = null;
      }
      const opts = this.getMapTileLayerOptions();
      this.mapTileLayer = L.tileLayer(opts.url, opts).addTo(this.mapInstance);
    },
    destroyMap() {
      if (this.mapLayer) {
        this.mapLayer.remove();
        this.mapLayer = null;
      }
      if (this.mapTileLayer) {
        this.mapTileLayer.remove();
        this.mapTileLayer = null;
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

      // Prefer explicit URL projection (`query.fields`) so the first fetch after
      // mount/remount respects deep-linked projections before `filteredPaths`
      // is rehydrated from schema paths.
      let fieldsParam = normalizeFieldsParamForApi(this.query?.fields);
      if (!fieldsParam && this.isProjectionMenuSelected === true) {
        const fieldPaths = this.filteredPaths && this.filteredPaths.length > 0
          ? this.filteredPaths.map(p => p.path).filter(Boolean)
          : null;
        if (fieldPaths && fieldPaths.length > 0) {
          fieldsParam = JSON.stringify(fieldPaths);
        }
      }
      if (fieldsParam) {
        params.fields = fieldsParam;
      }
      params.maxTimeMS = this.getQueryTimeoutMS();

      return params;
    },
    getQueryTimeoutMS() {
      const parsedSeconds = Number(this.queryTimeoutSeconds);
      const normalizedSeconds = Number.isFinite(parsedSeconds) && parsedSeconds > 0 ?
        parsedSeconds :
        DEFAULT_QUERY_TIMEOUT_SECONDS;
      return Math.floor(normalizedSeconds * 1000);
    },
    loadQueryTimeoutPreference() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      const stored = window.localStorage.getItem(QUERY_TIMEOUT_SECONDS_STORAGE_KEY);
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed > 0) {
        this.queryTimeoutSeconds = parsed;
        this.queryTimeoutDraftSeconds = String(parsed);
      }
    },
    openQueryTimeoutModal() {
      this.closeActionsMenu();
      this.queryTimeoutDraftSeconds = String(this.queryTimeoutSeconds);
      this.shouldShowQueryTimeoutModal = true;
    },
    saveQueryTimeoutPreference() {
      const parsed = Number(this.queryTimeoutDraftSeconds);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        this.$toast.error('Query timeout must be a positive number of seconds.');
        return;
      }
      const normalized = Math.round(parsed);
      this.queryTimeoutSeconds = normalized;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(QUERY_TIMEOUT_SECONDS_STORAGE_KEY, String(normalized));
      }
      this.shouldShowQueryTimeoutModal = false;
      this.$toast.success('Query timeout updated.');
    },
    setSearchTextFromRoute() {
      if (this.$route.query?.search) {
        this.searchText = this.$route.query.search;
      } else {
        this.searchText = '';
      }
    },
    async initSearchFromUrl() {
      this.status = 'loading';
      this.query = Object.assign({}, this.$route.query); // important that this is here before the if statements
      this.setSearchTextFromRoute();
      // Avoid eval() on user-controlled query params.
      // Use explicit sortKey + sortDirection query params.
      const sortKey = this.$route.query?.sortKey;
      const sortDirectionRaw = this.$route.query?.sortDirection;
      const sortDirection = typeof sortDirectionRaw === 'string' ? Number(sortDirectionRaw) : sortDirectionRaw;

      if (typeof sortKey === 'string' && sortKey.trim().length > 0 &&
        (sortDirection === 1 || sortDirection === -1)) {
        for (const key in this.sortBy) {
          delete this.sortBy[key];
        }
        this.sortBy[sortKey] = sortDirection;
        // Normalize to new params and remove legacy key if present.
        this.query.sortKey = sortKey;
        this.query.sortDirection = sortDirection;
        delete this.query.sort;
      }
      if (this.currentModel != null) {
        await this.getDocuments();
      }
      if (this.$route.query?.fields) {
        const urlPaths = parseFieldsQueryParam(this.$route.query.fields);
        if (urlPaths.length > 0) {
          this.filteredPaths = urlPaths.map(path => this.schemaPaths.find(p => p.path === path)).filter(Boolean);
          if (this.filteredPaths.length > 0) {
            this.syncProjectionFromPaths();
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
    filterDocument(doc) {
      if (this.filteredPaths.length === 0) return doc;
      const filteredDoc = {};
      for (let i = 0; i < this.filteredPaths.length; i++) {
        const path = this.filteredPaths[i].path;
        const value = mpath.get(path, doc);
        mpath.set(path, value, filteredDoc, function(cur, path, val) {
          if (arguments.length === 2) {
            if (cur[path] == null) {
              cur[path] = {};
            }
            return cur[path];
          }
          cur[path] = val;
          return val;
        });
      }
      return filteredDoc;
    },
    async checkIfScrolledToBottom() {
      if (this.status === 'loading' || this.loadedAllDocs) {
        return;
      }
      // Infinite scroll only applies to table/json views.
      if (this.outputType !== 'table' && this.outputType !== 'json') {
        return;
      }
      if (this.documents.length === 0) {
        return;
      }
      const container = this.outputType === 'table'
        ? this.$refs.documentsScrollContainer
        : this.$refs.documentsContainerScroll;
      if (!container || container.scrollHeight <= 0) {
        return;
      }
      const threshold = 150;
      const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;
      if (!nearBottom) {
        return;
      }
      this.loadingMore = true;
      this.status = 'loading';
      try {
        const skip = this.documents.length;
        const params = this.buildDocumentFetchParams({ skip });
        const { docs } = await api.Model.getDocuments(params);
        if (docs.length < limit) {
          this.loadedAllDocs = true;
        }
        this.documents.push(...docs);
      } finally {
        this.loadingMore = false;
        this.status = 'loaded';
      }
      this.$nextTick(() => this.checkIfScrolledToBottom());
    },
    async sortDocs(num, path) {
      let sorted = false;
      if (this.sortBy[path] == num) {
        sorted = true;
        delete this.query.sort;
        delete this.query.sortKey;
        delete this.query.sortDirection;
        this.$router.push({ query: this.query });
      }
      for (const key in this.sortBy) {
        delete this.sortBy[key];
      }
      if (!sorted) {
        this.sortBy[path] = num;
        this.query.sortKey = path;
        this.query.sortDirection = num;
        delete this.query.sort;
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
    toggleProjectionMenu() {
      const next = !this.isProjectionMenuSelected;
      this.isProjectionMenuSelected = next;

      // Because the route-view is keyed on `$route.fullPath`, query changes remount this component.
      // Persist projection UI state in the URL so Reset/Suggest don't turn the mode off.
      if (next) {
        this.query[PROJECTION_MODE_QUERY_KEY] = '1';
        if (this.outputType === 'map') {
          this.setOutputType('json');
        }
      } else {
        delete this.query[PROJECTION_MODE_QUERY_KEY];
        delete this.query.fields;
        this.filteredPaths = [];
        this.selectedPaths = [];
        this.projectionText = '';
      }

      this.$router.push({ query: this.query });
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
        sortDirection: 1,
        maxTimeMS: this.getQueryTimeoutMS()
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
    formatCompactCount(value) {
      if (typeof value !== 'number') {
        return '—';
      }
      if (value < 1000) {
        return `${value}`;
      }
      const formatValue = (number, suffix) => {
        const rounded = (Math.round(number * 10) / 10).toFixed(1).replace(/\.0$/, '');
        return `${rounded}${suffix}`;
      };
      if (value < 1000000) {
        return formatValue(value / 1000, 'k');
      }
      if (value < 1000000000) {
        return formatValue(value / 1000000, 'M');
      }
      return formatValue(value / 1000000000, 'B');
    },
    async getDocuments() {
      this.loadingMore = false;
      this.status = 'loading';
      try {
        // Track recently viewed model
        this.trackRecentModel(this.currentModel);

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
            const isProjectionModeOn = this.isProjectionMenuSelected === true;
            if (isProjectionModeOn) {
              this.applyDefaultProjection(event.suggestedFields);
            } else {
              this.filteredPaths = [];
              this.selectedPaths = [];
              this.projectionText = '';
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
            throw new Error(event.message);
          }
        }

        if (docsCount < limit) {
          this.loadedAllDocs = true;
        }
      } finally {
        this.status = 'loaded';
      }
      this.$nextTick(() => {
        this.restoreScrollPosition();
        if (!this.suppressScrollCheck) {
          this.checkIfScrolledToBottom();
        }
        this.suppressScrollCheck = false;
      });
    },
    async loadMoreDocuments() {
      const isLoadingMore = this.documents.length > 0;
      if (isLoadingMore) {
        this.loadingMore = true;
      }
      this.status = 'loading';
      try {
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
            throw new Error(event.message);
          }
        }

        if (docsCount < limit) {
          this.loadedAllDocs = true;
        }
      } finally {
        this.loadingMore = false;
        this.status = 'loaded';
      }
      this.$nextTick(() => this.checkIfScrolledToBottom());
    },
    applyDefaultProjection(suggestedFields) {
      if (Array.isArray(suggestedFields) && suggestedFields.length > 0) {
        this.filteredPaths = suggestedFields
          .map(path => this.schemaPaths.find(p => p.path === path))
          .filter(Boolean);
      }
      if (!this.filteredPaths || this.filteredPaths.length === 0) {
        this.filteredPaths = this.schemaPaths.slice(0, DEFAULT_FIRST_N_FIELDS);
      }
      if (this.filteredPaths.length === 0) {
        this.filteredPaths = this.schemaPaths.filter(p => p.path === '_id');
      }
    },
    clearProjection() {
      // Keep current filter input in sync with the URL so projection reset
      // does not unintentionally wipe the filter on remount.
      this.syncFilterToQuery();
      this.filteredPaths = [];
      this.selectedPaths = [];
      this.projectionText = '';
      this.updateProjectionQuery();
    },
    resetFilter() {
      // Reuse the existing "apply filter + update URL" flow.
      this.search('');
    },
    syncFilterToQuery() {
      if (typeof this.searchText === 'string' && this.searchText.trim().length > 0) {
        this.query.search = this.searchText;
      } else {
        delete this.query.search;
      }
    },
    applyDefaultProjectionColumns() {
      if (!this.schemaPaths || this.schemaPaths.length === 0) return;
      const pathNames = this.schemaPaths.map(p => p.path);
      this.applyDefaultProjection(pathNames.slice(0, DEFAULT_FIRST_N_FIELDS));
      this.selectedPaths = [...this.filteredPaths];
      this.syncProjectionFromPaths();
      this.updateProjectionQuery();
    },
    initProjection(ev) {
      if (!this.projectionText || !this.projectionText.trim()) {
        this.projectionText = '';
        this.$nextTick(() => {
          if (ev && ev.target) {
            ev.target.setSelectionRange(0, 0);
          }
        });
      }
    },
    syncProjectionFromPaths() {
      if (this.filteredPaths.length === 0) {
        this.projectionText = '';
        return;
      }
      // String-only projection syntax: `field1 field2` and `-field` for exclusions.
      // Since `filteredPaths` represents the final include set, we serialize as space-separated fields.
      this.projectionText = this.filteredPaths.map(p => p.path).join(' ');
    },
    parseProjectionInput(text) {
      if (!text || typeof text !== 'string') {
        return [];
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return [];
      }
      const normalizeKey = (key) => String(key).trim();

      // String-only projection syntax:
      //   name email
      //   -password   (exclusion-only)
      //   +email      (inclusion-only)
      //
      // Brace/object syntax is intentionally NOT supported.
      if (trimmed.startsWith('{') || trimmed.endsWith('}')) {
        return null;
      }

      const tokens = trimmed.split(/[,\s]+/).filter(Boolean);
      if (tokens.length === 0) return [];

      const includeKeys = [];
      const excludeKeys = [];

      for (const rawToken of tokens) {
        const token = rawToken.trim();
        if (!token) continue;

        const prefix = token[0];
        if (prefix === '-') {
          const path = token.slice(1).trim();
          if (!path) return null;
          excludeKeys.push(path);
        } else if (prefix === '+') {
          const path = token.slice(1).trim();
          if (!path) return null;
          includeKeys.push(path);
        } else {
          includeKeys.push(token);
        }
      }

      if (includeKeys.length > 0 && excludeKeys.length > 0) {
        // Support subtractive edits on an existing projection string, e.g.
        // `name email createdAt -email` -> `name createdAt`.
        const includeSet = new Set(includeKeys.map(normalizeKey));
        for (const path of excludeKeys) {
          includeSet.delete(normalizeKey(path));
        }
        return Array.from(includeSet);
      }

      if (excludeKeys.length > 0) {
        const excludeSet = new Set(excludeKeys.map(normalizeKey));
        return this.schemaPaths.map(p => p.path).filter(p => !excludeSet.has(p));
      }

      return includeKeys.map(normalizeKey);
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
    },
    updateProjectionQuery() {
      const paths = this.filteredPaths.map(x => x.path).filter(Boolean);
      if (paths.length > 0) {
        this.query.fields = JSON.stringify(paths);
      } else {
        delete this.query.fields;
      }
      this.$router.push({ query: this.query });
    },
    removeField(schemaPath) {
      if (this.outputType === 'table' && this.$refs.documentsScrollContainer) {
        this.scrollTopToRestore = this.$refs.documentsScrollContainer.scrollTop;
        this.suppressScrollCheck = true;
        // Persist for remount caused by query changes.
        if (typeof window !== 'undefined') {
          window.__studioModelsScrollTopToRestore = this.scrollTopToRestore;
          window.__studioModelsSuppressScrollCheck = true;
        }
      }
      const index = this.filteredPaths.findIndex(p => p.path === schemaPath.path);
      if (index !== -1) {
        this.filteredPaths.splice(index, 1);
        if (this.filteredPaths.length === 0) {
          const idPath = this.schemaPaths.find(p => p.path === '_id');
          this.filteredPaths = idPath ? [idPath] : [];
        }
        this.syncProjectionFromPaths();
        this.updateProjectionQuery();
      }
    },
    addField(schemaPath) {
      if (!this.filteredPaths.find(p => p.path === schemaPath.path)) {
        if (this.outputType === 'table' && this.$refs.documentsScrollContainer) {
          this.scrollTopToRestore = this.$refs.documentsScrollContainer.scrollTop;
          this.suppressScrollCheck = true;
          // Persist for remount caused by query changes.
          if (typeof window !== 'undefined') {
            window.__studioModelsScrollTopToRestore = this.scrollTopToRestore;
            window.__studioModelsSuppressScrollCheck = true;
          }
        }
        this.filteredPaths.push(schemaPath);
        this.filteredPaths.sort((a, b) => {
          if (a.path === '_id') return -1;
          if (b.path === '_id') return 1;
          return 0;
        });
        this.syncProjectionFromPaths();
        this.updateProjectionQuery();
        this.showAddFieldDropdown = false;
        this.addFieldFilterText = '';
      }
    },
    restoreScrollPosition() {
      if (this.outputType !== 'table') return;
      if (this.scrollTopToRestore == null) return;
      const container = this.$refs.documentsScrollContainer;
      if (!container) return;
      container.scrollTop = this.scrollTopToRestore;
      this.scrollTopToRestore = null;
    },
    toggleAddFieldDropdown() {
      this.showAddFieldDropdown = !this.showAddFieldDropdown;
      if (this.showAddFieldDropdown) {
        this.addFieldFilterText = '';
        this.$nextTick(() => this.$refs.addFieldFilterInput?.focus());
      }
    },
    getComponentForPath(schemaPath) {
      if (!schemaPath || typeof schemaPath !== 'object') {
        return 'list-mixed';
      }
      if (schemaPath.instance === 'Array') {
        return 'list-array';
      }
      if (schemaPath.instance === 'String') {
        return 'list-string';
      }
      if (schemaPath.instance === 'Embedded') {
        return 'list-subdocument';
      }
      if (schemaPath.instance === 'Mixed') {
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
    copyCellValue(value) {
      const text = value == null ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          this.$toast.success('Copied to clipboard');
        }).catch(() => {
          this.fallbackCopyText(text);
        });
      } else {
        this.fallbackCopyText(text);
      }
    },
    fallbackCopyText(text) {
      try {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        this.$toast.success('Copied to clipboard');
      } catch (err) {
        this.$toast.error('Copy failed');
      }
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
    },
    openModelSwitcher() {
      this.showModelSwitcher = true;
    },
    selectSwitcherModel(model) {
      this.showModelSwitcher = false;
      this.trackRecentModel(model);
      this.$router.push('/model/' + model);
    },
    async loadModelCounts() {
      if (!Array.isArray(this.models) || this.models.length === 0) {
        return;
      }
      try {
        const { counts } = await api.Model.getEstimatedDocumentCounts();
        if (counts && typeof counts === 'object') {
          this.modelDocumentCounts = counts;
        }
      } catch (err) {
        console.error('Failed to load model document counts', err);
      }
    }
  }
});
