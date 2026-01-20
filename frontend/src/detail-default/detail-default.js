'use strict';

/* global L */
const template = require('./detail-default.html');
module.exports = app => app.component('detail-default', {
  template: template,
  props: ['value'],
  data() {
    return {
      mapVisible: false,
      mapInstance: null,
      mapLayer: null
    };
  },
  computed: {
    displayValue() {
      if (this.value === null) {
        return 'null';
      }
      if (this.value === undefined) {
        return 'undefined';
      }
      if (typeof this.value === 'string') {
        return this.value;
      }
      if (typeof this.value === 'number' || typeof this.value === 'boolean' || typeof this.value === 'bigint') {
        return String(this.value);
      }
      try {
        return JSON.stringify(this.value, null, 2);
      } catch (err) {
        return String(this.value);
      }
    },
    isGeoJsonGeometry() {
      return this.value != null
        && typeof this.value === 'object'
        && !Array.isArray(this.value)
        && Object.prototype.hasOwnProperty.call(this.value, 'type')
        && Object.prototype.hasOwnProperty.call(this.value, 'coordinates');
    }
  },
  watch: {
    value: {
      handler() {
        if (this.mapVisible) {
          this.$nextTick(() => {
            this.ensureMap();
          });
        }
      },
      deep: true
    }
  },
  beforeDestroy() {
    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
      this.mapLayer = null;
    }
  },
  methods: {
    showText() {
      this.mapVisible = false;
    },
    showMap() {
      this.mapVisible = true;
      this.$nextTick(() => {
        this.ensureMap();
      });
    },
    ensureMap() {
      if (!this.mapVisible || !this.isGeoJsonGeometry || !this.$refs.map) {
        return;
      }
      if (!this.mapInstance) {
        this.mapInstance = L.map(this.$refs.map).setView([0, 0], 1);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.mapInstance);
      }
      this.updateMapLayer();
      this.$nextTick(() => {
        this.mapInstance.invalidateSize();
      });
    },
    updateMapLayer() {
      if (!this.mapInstance || !this.isGeoJsonGeometry) {
        return;
      }
      if (this.mapLayer) {
        this.mapLayer.remove();
      }
      const feature = {
        type: 'Feature',
        geometry: this.value,
        properties: {}
      };
      this.mapLayer = L.geoJSON(feature).addTo(this.mapInstance);
      const bounds = this.mapLayer.getBounds();
      if (bounds.isValid()) {
        this.mapInstance.fitBounds(bounds, { maxZoom: 16 });
      }
    }
  }
});
