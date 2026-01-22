'use strict';

/* global L */
const template = require('./detail-default.html');
const appendCSS = require('../appendCSS');

// Add CSS for polygon vertex markers and context menu
appendCSS(`
  .polygon-vertex-marker {
    pointer-events: auto !important;
  }
  .polygon-vertex-marker > div {
    pointer-events: auto !important;
  }
  .leaflet-context-menu {
    position: absolute;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 10000;
    min-width: 120px;
    padding: 4px 0;
  }
  .leaflet-context-menu-item {
    padding: 8px 16px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
  }
  .leaflet-context-menu-item:hover {
    background-color: #f0f0f0;
  }
  .leaflet-context-menu-item.delete {
    color: #dc3545;
  }
  .leaflet-context-menu-item.delete:hover {
    background-color: #fee;
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
      currentEditedGeometry: null, // Track the current edited geometry state
      contextMenu: null, // Custom context menu element
      contextMenuMarker: null, // Marker that triggered context menu
      originalGeometry: null, // Store the original geometry when editing starts
      isCreatingMarkers: false // Guard against re-entrant marker creation
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
    },
    canUndo() {
      // Can undo if there are any changes from the original geometry
      return this.hasUnsavedChanges && this.originalGeometry != null;
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
      handler(newValue) {
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
        // Store the new value as the original geometry for future edits
        if (newValue && this.isGeoJsonGeometry) {
          this.originalGeometry = JSON.parse(JSON.stringify(newValue));
        } else {
          this.originalGeometry = null;
        }
      },
      deep: true,
      immediate: true
    }
  },
  beforeDestroy() {
    this.hideContextMenu();
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

          // Ensure map container has relative positioning for context menu
          const mapContainer = this.mapInstance.getContainer();
          if (mapContainer) {
            mapContainer.style.position = 'relative';
          }

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
          interactive: this.isMultiPolygon // Only interactive for MultiPolygon (to allow edge clicks)
        }).addTo(this.mapInstance);

        // Add contextmenu handler to polygon edges to add vertices (only for MultiPolygon)
        if (this.isMultiPolygon) {
          this.mapLayer.eachLayer((layer) => {
            layer.on('contextmenu', (e) => {
              e.originalEvent.preventDefault();
              e.originalEvent.stopPropagation();

              // Check if clicking near an existing marker (using pixel distance)
              const clickPoint = e.latlng;
              const clickContainerPoint = this.mapInstance.latLngToContainerPoint(clickPoint);

              const isClickingOnMarker = this.draggableMarkers.some(marker => {
                if (!marker || !marker._icon) return false;
                const markerLatLng = marker.getLatLng();
                const markerContainerPoint = this.mapInstance.latLngToContainerPoint(markerLatLng);

                // Calculate pixel distance
                const dx = clickContainerPoint.x - markerContainerPoint.x;
                const dy = clickContainerPoint.y - markerContainerPoint.y;
                const pixelDistance = Math.sqrt(dx * dx + dy * dy);

                // 15 pixel threshold - marker icon is about 12px, so 15px gives some buffer
                return pixelDistance < 15;
              });

              if (!isClickingOnMarker) {
                this.showAddVertexContextMenu(e.originalEvent, clickPoint);
              }
            });
          });
        }

        // Make polygon layers non-interactive to avoid interfering with marker dragging
        this.mapLayer.eachLayer((layer) => {
          layer.setStyle({
            interactive: this.isMultiPolygon, // Only interactive for MultiPolygon (for context menu)
            stroke: true,
            weight: 2,
            opacity: 0.8
          });
          layer._path.style.pointerEvents = this.isMultiPolygon ? 'stroke' : 'none';
        });

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
        if (this.draggableMarkers.length !== expectedMarkerCount && !this.isCreatingMarkers) {
          this.isCreatingMarkers = true;
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

              // Add right-click handler to show context menu
              marker.on('contextmenu', (e) => {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                this.showContextMenu(e.originalEvent, markerActualIndex, marker);
                return false;
              });

              // Also attach directly to icon element as the event might not bubble to marker
              if (marker._icon) {
                marker._icon.addEventListener('contextmenu', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  this.showContextMenu(e, markerActualIndex, marker);
                  return false;
                }, true); // Use capture phase
              }

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
            // Reset the guard after all markers are created
            this.isCreatingMarkers = false;
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
          this.draggableMarkers = this.draggableMarkers.filter(marker => marker !== this.draggableMarker);
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
        interactive: this.isMultiPolygon // Only interactive for MultiPolygon (to allow edge clicks)
      }).addTo(this.mapInstance);

      // Add contextmenu handler to polygon edges to add vertices (only for MultiPolygon)
      if (this.isMultiPolygon && this.mapLayer.eachLayer) {
        this.mapLayer.eachLayer((layer) => {
          // Remove any existing contextmenu handlers first
          layer.off('contextmenu');

          layer.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();

            const clickPoint = e.latlng;
            const clickContainerPoint = this.mapInstance.latLngToContainerPoint(clickPoint);

            // Check if clicking near an existing marker
            const isClickingOnMarker = this.draggableMarkers.some(marker => {
              if (!marker || !marker._icon) return false;
              const markerLatLng = marker.getLatLng();
              const markerContainerPoint = this.mapInstance.latLngToContainerPoint(markerLatLng);

              const dx = clickContainerPoint.x - markerContainerPoint.x;
              const dy = clickContainerPoint.y - markerContainerPoint.y;
              const pixelDistance = Math.sqrt(dx * dx + dy * dy);

              return pixelDistance < 15;
            });

            if (!isClickingOnMarker) {
              this.showAddVertexContextMenu(e.originalEvent, clickPoint);
            }
          });

          // Style polygon layer
          if (layer.setStyle) {
            layer.setStyle({
              interactive: true,
              stroke: true,
              weight: 2,
              opacity: 0.8
            });
          }

          if (layer._path) {
            layer._path.style.pointerEvents = 'stroke';
          }
        });
      } else if (!this.isMultiPolygon && this.mapLayer.eachLayer) {
        // For regular Polygon, ensure it's non-interactive
        this.mapLayer.eachLayer((layer) => {
          layer.off('contextmenu'); // Remove any contextmenu handlers
          if (layer.setStyle) {
            layer.setStyle({ interactive: false });
          }
          if (layer._path) {
            layer._path.style.pointerEvents = 'none';
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
    showContextMenu(event, index, marker) {
      // Hide any existing context menu
      this.hideContextMenu();

      // Store the marker for deletion
      this.contextMenuMarker = { index, marker, type: 'vertex' };

      // Create context menu if it doesn't exist
      if (!this.contextMenu) {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'leaflet-context-menu';

        // Append to map container so it's positioned relative to the map
        if (this.mapInstance && this.mapInstance.getContainer()) {
          this.mapInstance.getContainer().appendChild(this.contextMenu);
        } else {
          document.body.appendChild(this.contextMenu);
        }
      }

      // Clear existing menu items
      this.contextMenu.innerHTML = '';

      // Add Delete option for vertices
      const deleteItem = document.createElement('div');
      deleteItem.className = 'leaflet-context-menu-item delete';
      deleteItem.textContent = 'Delete';
      deleteItem.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.contextMenuMarker && this.contextMenuMarker.type === 'vertex') {
          this.deleteVertex(this.contextMenuMarker.index, this.contextMenuMarker.marker);
        }
        this.hideContextMenu();
      });
      this.contextMenu.appendChild(deleteItem);

      // Get map container position for relative positioning
      const mapContainer = this.mapInstance ? this.mapInstance.getContainer() : null;
      let left = event.clientX;
      let top = event.clientY;

      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        left = event.clientX - rect.left;
        top = event.clientY - rect.top;
        this.contextMenu.style.position = 'absolute';
      } else {
        this.contextMenu.style.position = 'fixed';
      }

      // Position the context menu at the click location
      this.contextMenu.style.left = left + 'px';
      this.contextMenu.style.top = top + 'px';
      this.contextMenu.style.display = 'block';

      // Hide context menu when clicking elsewhere
      const hideMenu = (e) => {
        if (this.contextMenu && !this.contextMenu.contains(e.target)) {
          this.hideContextMenu();
          document.removeEventListener('click', hideMenu);
          document.removeEventListener('contextmenu', hideMenu);
        }
      };

      // Use setTimeout to avoid immediate hide from the current click
      setTimeout(() => {
        document.addEventListener('click', hideMenu);
        document.addEventListener('contextmenu', hideMenu);
      }, 10);
    },
    hideContextMenu() {
      if (this.contextMenu) {
        this.contextMenu.style.display = 'none';
      }
      this.contextMenuMarker = null;
    },
    showAddVertexContextMenu(event, latlng) {
      // Hide any existing context menu
      this.hideContextMenu();

      // Store the location for adding vertex
      this.contextMenuMarker = { latlng, type: 'edge' };

      // Create context menu if it doesn't exist
      if (!this.contextMenu) {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'leaflet-context-menu';

        // Append to map container so it's positioned relative to the map
        if (this.mapInstance && this.mapInstance.getContainer()) {
          this.mapInstance.getContainer().appendChild(this.contextMenu);
        } else {
          document.body.appendChild(this.contextMenu);
        }
      }

      // Clear existing menu items
      this.contextMenu.innerHTML = '';

      // Add "Add Vertex" option
      const addVertexItem = document.createElement('div');
      addVertexItem.className = 'leaflet-context-menu-item';
      addVertexItem.textContent = 'Add Vertex';
      addVertexItem.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.contextMenuMarker && this.contextMenuMarker.type === 'edge') {
          this.addVertexAtLocation(this.contextMenuMarker.latlng);
        }
        this.hideContextMenu();
      });
      this.contextMenu.appendChild(addVertexItem);

      // Position the context menu
      const mapContainer = this.mapInstance ? this.mapInstance.getContainer() : null;
      let left = event.clientX;
      let top = event.clientY;

      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        left = event.clientX - rect.left;
        top = event.clientY - rect.top;
        this.contextMenu.style.position = 'absolute';
      } else {
        this.contextMenu.style.position = 'fixed';
      }

      this.contextMenu.style.left = left + 'px';
      this.contextMenu.style.top = top + 'px';
      this.contextMenu.style.display = 'block';

      // Hide menu when clicking elsewhere
      const hideMenu = (e) => {
        if (!this.contextMenu || !this.contextMenu.contains(e.target)) {
          this.hideContextMenu();
          document.removeEventListener('click', hideMenu);
        }
      };
      setTimeout(() => {
        document.addEventListener('click', hideMenu);
      }, 0);
    },
    addVertexAtLocation(latlng) {
      // Get current geometry
      const baseGeometry = this.currentEditedGeometry || this.value;
      const newCoordinates = JSON.parse(JSON.stringify(baseGeometry.coordinates));

      // Get the outer ring
      let outerRing = [];
      if (this.isMultiPolygon) {
        outerRing = newCoordinates[0][0] || [];
      } else {
        outerRing = newCoordinates[0] || [];
      }

      if (outerRing.length === 0) {
        return;
      }

      // Check if this is a closed ring
      const isClosedRing = outerRing.length > 0 &&
        outerRing[0][0] === outerRing[outerRing.length - 1][0] &&
        outerRing[0][1] === outerRing[outerRing.length - 1][1];

      // Convert latlng to [lng, lat] format
      const newCoord = [latlng.lng, latlng.lat];

      // Find the closest edge segment and insert the vertex
      let closestEdgeIndex = 0;
      let minDistance = Infinity;

      // Check each edge segment
      for (let i = 0; i < outerRing.length - 1; i++) {
        const p1 = outerRing[i];
        const p2 = outerRing[i + 1];

        // Calculate distance from click point to edge segment
        const distance = this.distanceToLineSegment(
          [latlng.lng, latlng.lat],
          [p1[0], p1[1]],
          [p2[0], p2[1]]
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestEdgeIndex = i + 1; // Insert after point i
        }
      }

      // For closed rings, also check the edge from last to first
      if (isClosedRing) {
        const p1 = outerRing[outerRing.length - 1];
        const p2 = outerRing[0];
        const distance = this.distanceToLineSegment(
          [latlng.lng, latlng.lat],
          [p1[0], p1[1]],
          [p2[0], p2[1]]
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestEdgeIndex = outerRing.length; // Insert at end (before closing coordinate)
        }
      }

      // Insert the new coordinate
      if (this.isMultiPolygon) {
        newCoordinates[0][0].splice(closestEdgeIndex, 0, newCoord);
        // If it was a closed ring, update the closing coordinate
        if (isClosedRing) {
          newCoordinates[0][0][newCoordinates[0][0].length - 1] = newCoordinates[0][0][0];
        }
      } else {
        newCoordinates[0].splice(closestEdgeIndex, 0, newCoord);
        // If it was a closed ring, update the closing coordinate
        if (isClosedRing) {
          newCoordinates[0][newCoordinates[0].length - 1] = newCoordinates[0][0];
        }
      }

      const newGeometry = {
        type: baseGeometry.type,
        coordinates: newCoordinates
      };

      // Store the current edited geometry state
      this.currentEditedGeometry = newGeometry;
      this.hasUnsavedChanges = true;

      // Update the polygon layer and recreate markers
      this.updatePolygonLayer(newGeometry);
      this.$nextTick(() => {
        this.updateMapLayer();
      });

      // Notify parent of the change
      if (this.onChange) {
        this.onChange(newGeometry);
      }
    },
    distanceToLineSegment(point, lineStart, lineEnd) {
      // Calculate distance from point to line segment
      // point, lineStart, lineEnd are [lng, lat] arrays
      const A = point[0] - lineStart[0];
      const B = point[1] - lineStart[1];
      const C = lineEnd[0] - lineStart[0];
      const D = lineEnd[1] - lineStart[1];

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;

      if (lenSq !== 0) {
        param = dot / lenSq;
      }

      let xx, yy;

      if (param < 0) {
        xx = lineStart[0];
        yy = lineStart[1];
      } else if (param > 1) {
        xx = lineEnd[0];
        yy = lineEnd[1];
      } else {
        xx = lineStart[0] + param * C;
        yy = lineStart[1] + param * D;
      }

      const dx = point[0] - xx;
      const dy = point[1] - yy;

      // Use simple Euclidean distance (approximation for small areas)
      return Math.sqrt(dx * dx + dy * dy);
    },
    deleteVertex(index, marker) {
      // Get current geometry
      const baseGeometry = this.currentEditedGeometry || this.value;
      const newCoordinates = JSON.parse(JSON.stringify(baseGeometry.coordinates));

      // Get the outer ring
      let outerRing = [];
      if (this.isMultiPolygon) {
        outerRing = newCoordinates[0][0] || [];
      } else {
        outerRing = newCoordinates[0] || [];
      }

      // Check if this is a closed ring
      const isClosedRing = outerRing.length > 0 &&
        outerRing[0][0] === outerRing[outerRing.length - 1][0] &&
        outerRing[0][1] === outerRing[outerRing.length - 1][1];

      // Minimum vertices for a valid polygon (3 for triangle, but GeoJSON requires at least 4 for closed ring)
      const minVertices = isClosedRing ? 4 : 3;

      // Don't allow deletion if we'd have too few vertices
      const currentVertexCount = isClosedRing ? outerRing.length - 1 : outerRing.length;
      if (currentVertexCount < minVertices) {
        const message = isClosedRing
          ? `Cannot delete vertex. A polygon requires at least ${minVertices} vertices (including the closing vertex).`
          : `Cannot delete vertex. A polygon requires at least ${minVertices} vertices.`;
        this.$toast.error(message, {
          timeout: 5000
        });
        this.hideContextMenu();
        return; // Can't delete - would make invalid polygon
      }

      // Remove the coordinate
      if (this.isMultiPolygon) {
        newCoordinates[0][0].splice(index, 1);
        // If it was a closed ring and we removed a coordinate, update the closing coordinate
        if (isClosedRing && index === 0) {
          // If we deleted the first coordinate, the new first becomes the closing coordinate
          newCoordinates[0][0][newCoordinates[0][0].length - 1] = newCoordinates[0][0][0];
        } else if (isClosedRing && index === outerRing.length - 1) {
          // If we deleted the closing coordinate, update it to match the first
          newCoordinates[0][0][newCoordinates[0][0].length - 1] = newCoordinates[0][0][0];
        }
      } else {
        newCoordinates[0].splice(index, 1);
        // If it was a closed ring and we removed a coordinate, update the closing coordinate
        if (isClosedRing && index === 0) {
          // If we deleted the first coordinate, the new first becomes the closing coordinate
          newCoordinates[0][newCoordinates[0].length - 1] = newCoordinates[0][0];
        } else if (isClosedRing && index === outerRing.length - 1) {
          // If we deleted the closing coordinate, update it to match the first
          newCoordinates[0][newCoordinates[0].length - 1] = newCoordinates[0][0];
        }
      }

      const newGeometry = {
        type: baseGeometry.type,
        coordinates: newCoordinates
      };

      // Store the current edited geometry state
      this.currentEditedGeometry = newGeometry;
      this.hasUnsavedChanges = true;

      // Remove all markers and force recreation (needed because marker closures capture indices)
      this.draggableMarkers.forEach(m => {
        if (m) m.remove();
      });
      this.draggableMarkers = [];

      // Update the polygon layer and recreate markers
      this.updatePolygonLayer(newGeometry);
      this.$nextTick(() => {
        this.updateMapLayer();
      });

      // Notify parent of the change
      if (this.onChange) {
        this.onChange(newGeometry);
      }
    },
    undoDelete() {
      // Restore the original geometry (undo all changes)
      if (!this.originalGeometry) {
        return;
      }

      const restoredGeometry = JSON.parse(JSON.stringify(this.originalGeometry));

      // Clear all edited state
      this.currentEditedGeometry = null;
      this.hasUnsavedChanges = false;

      // Update the map to show the original geometry
      if (this.isGeoJsonPoint) {
        this.$nextTick(() => {
          this.updateMapLayer();
        });
      } else if (this.isGeoJsonPolygon) {
        this.updatePolygonLayer(restoredGeometry);
        this.$nextTick(() => {
          this.updateMapLayer();
        });
      }

      // Notify parent of the change (restore to original)
      if (this.onChange) {
        this.onChange(restoredGeometry);
      }
    }
  }
});
