/* global L */
'use strict';

const template = require('./dashboard-map.html');

module.exports = app => app.component('dashboard-map', {
  template: template,
  props: ['value'],
  mounted() {
    const fc = this.value.$featureCollection.featureCollection || this.value.$featureCollection;
    const map = L.map(this.$refs.map).setView([0, 0], 1);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    const layer = L.geoJSON(fc).addTo(map);
    try {
      map.fitBounds(layer.getBounds());
    } catch (err) {
      // Ignore errors fitting bounds
    }
  },
  computed: {
    header() {
      if (this.value != null && this.value.$featureCollection.header) {
        return this.value.$featureCollection.header;
      }
      return null;
    }
  }
});
