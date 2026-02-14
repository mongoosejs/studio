/* global L */
'use strict';

const template = require('./dashboard-map.html');

module.exports = app => app.component('dashboard-map', {
  template: template,
  props: ['value', 'height'],
  mounted() {
    const fc = this.value.$featureCollection.featureCollection || this.value.$featureCollection;
    const map = L.map(this.$refs.map).setView([0, 0], 1);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    const defaultModel = this.value?.$featureCollection?.model;
    const layer = L.geoJSON(fc, {
      onEachFeature: (feature, layer) => {
        const properties = feature?.properties || {};
        const documentId = properties._id || properties.id || feature?.id;
        const featureModel = properties.model || defaultModel;
        const documentUrl = properties.documentUrl || (featureModel && documentId ? `#/model/${featureModel}/document/${documentId}` : null);

        if (documentUrl) {
          const anchor = document.createElement('a');
          anchor.href = documentUrl;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.textContent = properties.name || properties.title || properties.label || documentId || 'View document';
          layer.bindPopup(anchor);
        } else if (documentId != null) {
          layer.bindPopup(String(documentId));
        }
      }
    }).addTo(map);

    this.$nextTick(() => {
      map.invalidateSize();
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds);
      }
    });
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
