'use strict';

/* global L */
const template = require('./detail-default.html');
module.exports = app => app.component('detail-default', {
  template: template,
  props: ['value', 'viewMode', 'onChange'],
  data() {
    return {
      mapVisible: false,
      mapInstance: null,
      mapLayer: null,
      draggableMarker: null,
      hasUnsavedChanges: false
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
    },
    isGeoJsonPoint() {
      return this.isGeoJsonGeometry && this.value.type === 'Point';
    },
    isEditable() {
      return this.isGeoJsonPoint && typeof this.onChange === 'function';
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
        // Reset unsaved changes flag when value changes externally (e.g., after save)
        if (this.hasUnsavedChanges && this.isGeoJsonPoint) {
          this.hasUnsavedChanges = false;
        }
      },
      deep: true
    }
  },
  beforeDestroy() {
    if (this.draggableMarker) {
      this.draggableMarker.remove();
      this.draggableMarker = null;
    }
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
      
      try {
        // For Point geometries in edit mode, use a draggable marker
        if (this.isGeoJsonPoint && this.isEditable) {
          const [lng, lat] = this.value.coordinates;
          
          // If marker exists, update its position instead of recreating
          if (this.draggableMarker) {
            const currentLatLng = this.draggableMarker.getLatLng();
            // Only update if coordinates actually changed (avoid interrupting drag)
            if (Math.abs(currentLatLng.lat - lat) > 0.0001 || Math.abs(currentLatLng.lng - lng) > 0.0001) {
              this.draggableMarker.setLatLng([lat, lng]);
            }
          } else {
            // Create new draggable marker
            this.draggableMarker = L.marker([lat, lng], {
              draggable: true
            }).addTo(this.mapInstance);
            
            // Add dragend event handler
            this.draggableMarker.on('dragend', () => {
              const newLat = this.draggableMarker.getLatLng().lat;
              const newLng = this.draggableMarker.getLatLng().lng;
              const newGeometry = {
                type: 'Point',
                coordinates: [newLng, newLat]
              };
              this.hasUnsavedChanges = true;
              if (this.onChange) {
                this.onChange(newGeometry);
              }
            });
            
            // Center map on marker if it's the first time
            if (!this.mapInstance.getBounds().isValid()) {
              this.mapInstance.setView([lat, lng], Math.max(this.mapInstance.getZoom(), 10));
            }
          }
          
          // Remove any existing non-draggable layer
          if (this.mapLayer) {
            this.mapLayer.remove();
            this.mapLayer = null;
          }
        } else {
          // For other geometries or non-editable mode, use standard GeoJSON layer
          if (this.draggableMarker) {
            this.draggableMarker.remove();
            this.draggableMarker = null;
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
      } catch (error) {
        // Silently handle errors
      }
    },
    resetUnsavedChanges() {
      this.hasUnsavedChanges = false;
    }
  }
});
