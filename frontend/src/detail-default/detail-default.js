'use strict';

/* global L */
const template = require('./detail-default.html');
module.exports = app => app.component('detail-default', {
  template: template,
  props: ['value', 'viewMode'],
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
    viewMode: {
      handler(newValue) {
        this.mapVisible = newValue === 'map';
        if (this.mapVisible) {
          this.$nextTick(() => {
            this.ensureMap();
          });
        }
      },
      immediate: true
    },
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
    ensureMap() {
      if (!this.mapVisible || !this.isGeoJsonGeometry || !this.$refs.map) {
        return;
      }
      
      if (typeof L === 'undefined') {
        return;
      }
      
      if (!this.mapInstance) {
        // Ensure the map container has explicit dimensions
        const mapElement = this.$refs.map;
        if (mapElement) {
          // Set explicit dimensions inline with !important to override any CSS
          mapElement.style.setProperty('height', '256px', 'important');
          mapElement.style.setProperty('min-height', '256px', 'important');
          mapElement.style.setProperty('width', '100%', 'important');
          mapElement.style.setProperty('display', 'block', 'important');
          
          // Force a reflow to ensure dimensions are applied
          void mapElement.offsetHeight;
        }
        
        try {
          this.mapInstance = L.map(this.$refs.map, {
            preferCanvas: false
          }).setView([0, 0], 1);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(this.mapInstance);
          
          // Explicitly invalidate size after creation to ensure proper rendering
          this.$nextTick(() => {
            if (this.mapInstance) {
              this.mapInstance.invalidateSize();
            }
          });
        } catch (error) {
          return;
        }
      }
      
      this.updateMapLayer();
      this.$nextTick(() => {
        if (this.mapInstance) {
          this.mapInstance.invalidateSize();
        }
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
      
      try {
        this.mapLayer = L.geoJSON(feature).addTo(this.mapInstance);
        const bounds = this.mapLayer.getBounds();
        if (bounds.isValid()) {
          this.mapInstance.fitBounds(bounds, { maxZoom: 16 });
        }
      } catch (error) {
        // Silently handle errors
      }
    }
  }
});
