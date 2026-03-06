/* global L */
'use strict';

const template = require('./dashboard-map.html');

function getMapTileLayerOptions() {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return isDark
    ? { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>', subdomains: 'abcd', maxZoom: 20 }
    : { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' };
}

module.exports = app => app.component('dashboard-map', {
  template: template,
  props: ['value', 'height'],
  data() {
    return { _map: null, _tileLayer: null };
  },
  mounted() {
    const fc = this.value.$featureCollection.featureCollection || this.value.$featureCollection;
    const map = L.map(this.$refs.map).setView([0, 0], 1);
    this._map = map;
    const opts = getMapTileLayerOptions();
    this._tileLayer = L.tileLayer(opts.url, opts).addTo(map);
    const layer = L.geoJSON(fc).addTo(map);

    this.$nextTick(() => {
      map.invalidateSize();
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds);
      }
    });
    this._onStudioThemeChanged = () => this._updateMapTileLayer();
    document.documentElement.addEventListener('studio-theme-changed', this._onStudioThemeChanged);
  },
  beforeDestroy() {
    document.documentElement.removeEventListener('studio-theme-changed', this._onStudioThemeChanged);
  },
  methods: {
    _updateMapTileLayer() {
      if (!this._map || !this._tileLayer || typeof L === 'undefined') return;
      this._tileLayer.remove();
      this._tileLayer = null;
      const opts = getMapTileLayerOptions();
      this._tileLayer = L.tileLayer(opts.url, opts).addTo(this._map);
    }
  },
  computed: {
    mapStyle() {
      return { height: this.height || '300px' };
    },
    header() {
      if (this.value != null && this.value.$featureCollection.header) {
        return this.value.$featureCollection.header;
      }
      return null;
    }
  }
});
