'use strict';

/* global L */
const template = require('./detail-default.html');
const appendCSS = require('../appendCSS');

// Add CSS for polygon vertex markers
appendCSS(`
  .polygon-vertex-marker {
    pointer-events: auto !important;
  }
  .polygon-vertex-marker > div {
    pointer-events: auto !important;
  }
`);

module.exports = app => app.component('detail-default', {
  template: template,
  props: ['value', 'viewMode', 'onChange'],
  data() {
    return {
      mapVisible: false,
      mapInstance: null,
      mapLayer: null,
      draggableMarker: null,
      draggableMarkers: [], // For polygon vertices
      hasUnsavedChanges: false,
      currentEditedGeometry: null // Track the current edited geometry state
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
    isGeoJsonPolygon() {
      return this.isGeoJsonGeometry && (this.value.type === 'Polygon' || this.value.type === 'MultiPolygon');
    },
    isMultiPolygon() {
      return this.isGeoJsonGeometry && this.value.type === 'MultiPolygon';
    },
    isEditable() {
      return (this.isGeoJsonPoint || this.isGeoJsonPolygon) && typeof this.onChange === 'function';
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
        if (this.hasUnsavedChanges && (this.isGeoJsonPoint || this.isGeoJsonPolygon)) {
          this.hasUnsavedChanges = false;
          this.currentEditedGeometry = null; // Reset edited geometry when value changes externally
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
    // Clean up polygon vertex markers
    this.draggableMarkers.forEach(marker => {
      if (marker) {
        marker.remove();
      }
    });
    this.draggableMarkers = [];
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
            
            // Center map on marker with appropriate zoom level
            const currentZoom = this.mapInstance.getZoom();
            // If zoom is too low (less than 10), set a good default zoom level (13)
            const targetZoom = currentZoom < 10 ? 13 : currentZoom;
            this.mapInstance.setView([lat, lng], targetZoom);
          }
          
          // Remove any existing non-draggable layer
          if (this.mapLayer) {
            this.mapLayer.remove();
            this.mapLayer = null;
          }
          
          // Clean up polygon markers if they exist
          this.draggableMarkers.forEach(marker => {
            if (marker) marker.remove();
          });
          this.draggableMarkers = [];
        } else if (this.isGeoJsonPolygon && this.isEditable) {
          // Initialize current edited geometry if not set
          if (!this.currentEditedGeometry) {
            this.currentEditedGeometry = JSON.parse(JSON.stringify(this.value));
          }
          
          // For Polygon geometries in edit mode, create polygon layer with draggable vertex markers
          // Use current edited geometry if available, otherwise use value
          const polygonGeometryToUse = this.currentEditedGeometry || this.value;
          const feature = {
            type: 'Feature',
            geometry: polygonGeometryToUse,
            properties: {}
          };
          
          // Update or create polygon layer
          if (this.mapLayer) {
            this.mapLayer.remove();
          }
          this.mapLayer = L.geoJSON(feature, {
            style: {
              color: '#3388ff',
              weight: 2,
              opacity: 0.8,
              fillOpacity: 0.2
            },
            interactive: false // Make polygon non-interactive so markers can be dragged
          }).addTo(this.mapInstance);
          
          // Ensure polygon layer doesn't interfere with marker interactions
          // This is the FIRST FIX: Aggressively disable pointer events on polygon
          if (this.mapLayer.eachLayer) {
            this.mapLayer.eachLayer((layer) => {
              if (layer.setStyle) {
                layer.setStyle({ interactive: false });
              }
              // Disable pointer events on the SVG path element directly
              if (layer._path) {
                layer._path.style.pointerEvents = 'none';
              }
              // Also try to disable on renderer if it exists
              if (layer._renderer && layer._renderer._container) {
                layer._renderer._container.style.pointerEvents = 'none';
              }
            });
          }
          
          // Additional fix: Use setTimeout to ensure DOM is ready, then disable pointer events
          setTimeout(() => {
            if (this.mapLayer && this.mapLayer.eachLayer) {
              this.mapLayer.eachLayer((layer) => {
                if (layer._path) {
                  layer._path.setAttribute('style', layer._path.getAttribute('style') + '; pointer-events: none !important;');
                }
              });
            }
          }, 100);
          
          // Get the outer ring coordinates
          // For Polygon: coordinates[0] is the outer ring
          // For MultiPolygon: coordinates[0][0] is the first polygon's outer ring
          // Use current edited geometry if available
          const ringGeometryToUse = this.currentEditedGeometry || this.value;
          let outerRing = [];
          
          if (this.isMultiPolygon) {
            // MultiPolygon structure: [[[[lng, lat], ...]], [[[lng, lat], ...]]]
            // Get the first polygon's outer ring
            if (ringGeometryToUse.coordinates[0] && ringGeometryToUse.coordinates[0][0]) {
              outerRing = ringGeometryToUse.coordinates[0][0];
            }
          } else {
            // Polygon structure: [[[lng, lat], ...]]
            outerRing = ringGeometryToUse.coordinates[0] || [];
          }
          
          if (outerRing.length === 0) {
            return;
          }
          
          // Determine how many markers we should have (accounting for closed rings)
          const isClosedRing = outerRing.length > 0 && 
            outerRing[0][0] === outerRing[outerRing.length - 1][0] && 
            outerRing[0][1] === outerRing[outerRing.length - 1][1];
          const expectedMarkerCount = isClosedRing ? outerRing.length - 1 : outerRing.length;
          
          // Remove existing markers if count doesn't match
          if (this.draggableMarkers.length !== expectedMarkerCount) {
            this.draggableMarkers.forEach(marker => {
              if (marker) marker.remove();
            });
            this.draggableMarkers = [];
            
            // Create draggable markers for each vertex
            // Use setTimeout to ensure markers are added after polygon layer is fully rendered
            this.$nextTick(() => {
              // GeoJSON polygons typically have the first and last coordinate the same (closed ring)
              // We'll create markers for all coordinates except the last one if it's a duplicate
              // But we need to track the original index for updating the correct coordinate
              const isClosedRing = outerRing.length > 0 && 
                outerRing[0][0] === outerRing[outerRing.length - 1][0] && 
                outerRing[0][1] === outerRing[outerRing.length - 1][1];
              
              const coordsToProcess = isClosedRing 
                ? outerRing.slice(0, -1) // Skip last coordinate if it's a duplicate of first
                : outerRing;
              
              coordsToProcess.forEach((coord, visibleIndex) => {
                // visibleIndex is the index in the visible markers array
                // actualIndex is the index in the coordinates array (same for non-closed rings)
                const actualIndex = visibleIndex;
                if (!Array.isArray(coord) || coord.length < 2) {
                  return;
                }
                
                const [lng, lat] = coord;
                
                // Create a custom icon for the vertex marker
                const icon = L.divIcon({
                  className: 'polygon-vertex-marker',
                  html: '<div style="width: 12px; height: 12px; background-color: #3388ff; border: 2px solid white; border-radius: 50%; cursor: move;"></div>',
                  iconSize: [12, 12],
                  iconAnchor: [6, 6]
                });
                
                const marker = L.marker([lat, lng], {
                  draggable: true,
                  icon: icon,
                  zIndexOffset: 1000, // Ensure markers are above polygon layer
                  riseOnHover: true, // Bring marker to front on hover
                  bubblingMouseEvents: false // Prevent events from bubbling to polygon
                });
                
                // Add marker to map
                marker.addTo(this.mapInstance);
                
                // Ensure marker is in the marker pane (above overlay pane where polygon is)
                // Note: markers don't have bringToFront(), we use zIndexOffset and DOM manipulation
                if (marker._icon) {
                  marker._icon.style.pointerEvents = 'auto';
                  marker._icon.style.zIndex = (1001 + visibleIndex).toString(); // Unique z-index for each marker
                  // Move marker icon to top of marker pane
                  if (marker._icon.parentNode) {
                    marker._icon.parentNode.appendChild(marker._icon);
                  }
                }
                
                // Add dragend event handler
                // Store the actualIndex in closure for this marker
                const markerActualIndex = actualIndex;
                const markerIsFirstInClosedRing = isClosedRing && actualIndex === 0;
                
                marker.on('dragend', () => {
                  const newLat = marker.getLatLng().lat;
                  const newLng = marker.getLatLng().lng;
                  
                  // Use current edited geometry if available, otherwise use original value
                  const baseGeometry = this.currentEditedGeometry || this.value;
                  const newCoordinates = JSON.parse(JSON.stringify(baseGeometry.coordinates));
                  
                  // Get the outer ring to check if it's closed
                  let outerRing = [];
                  if (this.isMultiPolygon) {
                    outerRing = newCoordinates[0][0] || [];
                  } else {
                    outerRing = newCoordinates[0] || [];
                  }
                  
                  // Check if this is a closed ring
                  const isClosedRingNow = outerRing.length > 0 && 
                    outerRing[0][0] === outerRing[outerRing.length - 1][0] && 
                    outerRing[0][1] === outerRing[outerRing.length - 1][1];
                  
                  // Update the coordinate
                  if (this.isMultiPolygon) {
                    // MultiPolygon: coordinates[0][0][index] = [lng, lat]
                    newCoordinates[0][0][markerActualIndex] = [newLng, newLat];
                    // If closed ring and this is the first coordinate, also update the closing coordinate
                    if (isClosedRingNow && markerIsFirstInClosedRing) {
                      newCoordinates[0][0][outerRing.length - 1] = [newLng, newLat];
                    }
                  } else {
                    // Polygon: coordinates[0][index] = [lng, lat]
                    newCoordinates[0][markerActualIndex] = [newLng, newLat];
                    // If closed ring and this is the first coordinate, also update the closing coordinate
                    if (isClosedRingNow && markerIsFirstInClosedRing) {
                      newCoordinates[0][outerRing.length - 1] = [newLng, newLat];
                    }
                  }
                  
                  // Validate coordinate structure before creating geometry
                  try {
                    // Ensure coordinates are valid numbers
                    if (isNaN(newLng) || isNaN(newLat)) {
                      throw new Error(`Invalid coordinates: [${newLng}, ${newLat}]`);
                    }
                    
                    const newGeometry = {
                      type: baseGeometry.type, // Preserve Polygon or MultiPolygon type
                      coordinates: newCoordinates
                    };
                    
                    // Validate the geometry structure
                    if (!newGeometry.type || !Array.isArray(newGeometry.coordinates)) {
                      throw new Error('Invalid geometry structure');
                    }
                    
                    // Store the current edited geometry state
                    this.currentEditedGeometry = newGeometry;
                    this.hasUnsavedChanges = true;
                    
                    // Update the polygon layer immediately for visual feedback
                    this.updatePolygonLayer(newGeometry);
                    
                    // Notify parent of the change
                    if (this.onChange) {
                      this.onChange(newGeometry);
                    }
                  } catch (error) {
                    // Silently handle errors
                  }
                });
                
                this.draggableMarkers.push(marker);
              });
            });
          } else {
            // Update existing marker positions if coordinates changed
            // Get the correct outer ring based on geometry type
            // Use current edited geometry if available
            const updateGeometryToUse = this.currentEditedGeometry || this.value;
            let currentOuterRing = [];
            if (this.isMultiPolygon) {
              if (updateGeometryToUse.coordinates[0] && updateGeometryToUse.coordinates[0][0]) {
                currentOuterRing = updateGeometryToUse.coordinates[0][0];
              }
            } else {
              currentOuterRing = updateGeometryToUse.coordinates[0] || [];
            }
            
            currentOuterRing.forEach((coord, index) => {
              const [lng, lat] = coord;
              const marker = this.draggableMarkers[index];
              if (marker) {
                const currentLatLng = marker.getLatLng();
                // Only update if coordinates actually changed (avoid interrupting drag)
                if (Math.abs(currentLatLng.lat - lat) > 0.0001 || Math.abs(currentLatLng.lng - lng) > 0.0001) {
                  marker.setLatLng([lat, lng]);
                }
              }
            });
            
            // Update polygon layer to reflect any coordinate changes
            // Use current edited geometry if available, otherwise use value
            const layerGeometryToUse = this.currentEditedGeometry || this.value;
            this.updatePolygonLayer(layerGeometryToUse);
          }
          
          // Remove point marker if it exists
          if (this.draggableMarker) {
            this.draggableMarker.remove();
            this.draggableMarker = null;
          }
          
          // Fit bounds to polygon
          const bounds = this.mapLayer.getBounds();
          if (bounds.isValid()) {
            const currentZoom = this.mapInstance.getZoom();
            if (currentZoom < 10) {
              this.mapInstance.fitBounds(bounds, { maxZoom: 16 });
            } else {
              // Just ensure polygon is visible, don't change zoom if already zoomed in
              if (!bounds.contains(this.mapInstance.getBounds())) {
                this.mapInstance.fitBounds(bounds, { maxZoom: 16 });
              }
            }
          }
        } else {
          // For other geometries or non-editable mode, use standard GeoJSON layer
          if (this.draggableMarker) {
            this.draggableMarker.remove();
            this.draggableMarker = null;
          }
          
          // Clean up polygon markers
          this.draggableMarkers.forEach(marker => {
            if (marker) marker.remove();
          });
          this.draggableMarkers = [];
          
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
    updatePolygonLayer(geometry) {
      if (!this.mapInstance || !this.mapLayer) {
        return;
      }
      
      // Remove old layer
      this.mapLayer.remove();
      
      // Create new layer with updated geometry
      const feature = {
        type: 'Feature',
        geometry: geometry,
        properties: {}
      };
      
      this.mapLayer = L.geoJSON(feature, {
        style: {
          color: '#3388ff',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.2
        },
        interactive: false // Make polygon non-interactive so markers can be dragged
      }).addTo(this.mapInstance);
      
      // Ensure polygon layer doesn't interfere with marker interactions
      if (this.mapLayer.eachLayer) {
        this.mapLayer.eachLayer((layer) => {
          if (layer.setStyle) {
            layer.setStyle({ interactive: false });
          }
        });
      }
      
      // Bring all markers to front after updating polygon
      // Note: markers don't have bringToFront(), we manipulate DOM directly
      this.draggableMarkers.forEach((marker, index) => {
        if (marker && marker._icon && marker._icon.parentNode) {
          marker._icon.style.zIndex = (1001 + index).toString();
          marker._icon.parentNode.appendChild(marker._icon);
        }
      });
    },
    resetUnsavedChanges() {
      this.hasUnsavedChanges = false;
    }
  }
});
