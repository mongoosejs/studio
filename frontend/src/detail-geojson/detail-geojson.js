'use strict';

const template = require('./detail-geojson.html');
const appendCSS = require('../appendCSS');

appendCSS(require('./detail-geojson.css'));

module.exports = app => app.component('detail-geojson', {
  template,
  props: ['value'],
  data() {
    return {
      activeTab: 'raw',
      map: null,
      geoJsonLayer: null,
      mapError: null
    };
  },
  mounted() {
    if (this.activeTab === 'map') {
      this.initializeMap();
    }
  },
  beforeDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.geoJsonLayer = null;
    }
  },
  watch: {
    value: {
      deep: true,
      handler() {
        if (this.map) {
          this.renderGeoJSON();
        }
      }
    }
  },
  computed: {
    formattedValue() {
      try {
        return JSON.stringify(this.value, null, 2);
      } catch (err) {
        return String(this.value);
      }
    }
  },
  methods: {
    setActiveTab(tab) {
      this.activeTab = tab;
      if (tab === 'map') {
        this.$nextTick(() => this.initializeMap());
      }
    },
    initializeMap() {
      if (this.map || typeof L === 'undefined' || !this.$refs.mapContainer) {
        this.renderGeoJSON();
        return;
      }

      this.map = L.map(this.$refs.mapContainer).setView([0, 0], 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);

      this.renderGeoJSON();
    },
    renderGeoJSON() {
      if (!this.map || typeof L === 'undefined') {
        return;
      }

      if (this.geoJsonLayer) {
        this.geoJsonLayer.remove();
        this.geoJsonLayer = null;
      }

      try {
        this.geoJsonLayer = L.geoJSON(this.value);
        this.geoJsonLayer.addTo(this.map);

        const bounds = this.geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          this.map.fitBounds(bounds, { padding: [20, 20] });
        } else {
          this.map.setView([0, 0], 2);
        }
        this.map.invalidateSize();
        this.mapError = null;
      } catch (err) {
        this.mapError = 'Unable to render GeoJSON on the map.';
      }
    }
  }
});
