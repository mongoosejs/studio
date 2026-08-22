'use strict';

/* global L */
const template = require('./detail-default.html');

module.exports = app => app.component('detail-default', {
  template,
  props: ['value', 'viewMode'],
  data() {
    return { mapVisible: false, mapInstance: null, mapLayer: null, mapTileLayer: null };
  },
  computed: {
    displayValue() {
      if (this.value == null) return String(this.value);
      if (typeof this.value === 'string') return this.value;
      if (typeof this.value !== 'object') return String(this.value);
      return JSON.stringify(this.value, null, 2);
    },
    isGeoJsonGeometry() {
      return this.value != null && typeof this.value === 'object' && !Array.isArray(this.value)
        && Object.prototype.hasOwnProperty.call(this.value, 'type')
        && Object.prototype.hasOwnProperty.call(this.value, 'coordinates');
    }
  },
  watch: {
    viewMode: {
      handler(newValue) {
        this.mapVisible = newValue === 'map';
        if (this.mapVisible) this.$nextTick(() => this.ensureMap());
      },
      immediate: true
    },
    value: {
      handler() {
        if (this.mapVisible) this.$nextTick(() => this.ensureMap());
      },
      deep: true
    }
  },
  beforeDestroy() {
    document.documentElement.removeEventListener('studio-theme-changed', this._onStudioThemeChanged);
    if (this.mapInstance) this.mapInstance.remove();
    this.mapInstance = null;
    this.mapLayer = null;
    this.mapTileLayer = null;
  },
  methods: {
    ensureMap() {
      if (!this.mapVisible || !this.isGeoJsonGeometry || !this.$refs.map || typeof L === 'undefined') return;
      if (!this.mapInstance) {
        this.mapInstance = L.map(this.$refs.map, { preferCanvas: false }).setView([0, 0], 1);
        this.updateMapTileLayer();
        this._onStudioThemeChanged = () => this.updateMapTileLayer();
        document.documentElement.addEventListener('studio-theme-changed', this._onStudioThemeChanged);
      }
      this.updateMapLayer();
      this.$nextTick(() => this.mapInstance?.invalidateSize());
    },
    getMapTileLayerOptions() {
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      return isDark
        ? { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>', subdomains: 'abcd', maxZoom: 20 }
        : { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' };
    },
    updateMapTileLayer() {
      if (!this.mapInstance || typeof L === 'undefined') return;
      if (this.mapTileLayer) this.mapTileLayer.remove();
      const opts = this.getMapTileLayerOptions();
      this.mapTileLayer = L.tileLayer(opts.url, opts).addTo(this.mapInstance);
    },
    updateMapLayer() {
      if (!this.mapInstance || !this.isGeoJsonGeometry) return;
      if (this.mapLayer) this.mapLayer.remove();
      this.mapLayer = L.geoJSON({ type: 'Feature', geometry: this.value, properties: {} }, {
        style: { color: '#3388ff', weight: 2, opacity: 0.8, fillOpacity: 0.2 }
      }).addTo(this.mapInstance);
      const bounds = this.mapLayer.getBounds();
      if (bounds.isValid()) this.mapInstance.fitBounds(bounds, { maxZoom: 16 });
    }
  }
});
