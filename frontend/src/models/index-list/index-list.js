'use strict';

const api = require('../../api');
const template = require('./index-list.html');

module.exports = app => app.component('index-list', {
  template: template,
  props: ['currentModel'],
  emits: ['close'],
  data: () => ({
    mongoDBIndexes: null,
    schemaIndexes: [],
    expandedIndexes: new Set()
  }),
  async mounted() {
    const { mongoDBIndexes, schemaIndexes } = await api.Model.getIndexes({ model: this.currentModel });
    this.mongoDBIndexes = mongoDBIndexes;
    this.schemaIndexes = schemaIndexes;
  },
  methods: {
    toggleIndex(name) {
      if (this.expandedIndexes.has(name)) {
        this.expandedIndexes.delete(name);
      } else {
        this.expandedIndexes.add(name);
      }
    },
    async dropIndex(name) {
      const { mongoDBIndexes } = await api.Model.dropIndex({ model: this.currentModel, name });
      this.mongoDBIndexes = mongoDBIndexes;
      this.expandedIndexes.delete(name);
      this.$toast.success('Index dropped!');
    },
    formatTTL(expireAfterSeconds) {
      if (typeof expireAfterSeconds !== 'number') {
        return '';
      }

      let remaining = expireAfterSeconds;
      const days = Math.floor(remaining / (24 * 60 * 60));
      remaining = remaining % (24 * 60 * 60);
      const hours = Math.floor(remaining / (60 * 60));
      remaining = remaining % (60 * 60);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;

      const parts = [];
      if (days > 0) {
        parts.push(`${days} day${days === 1 ? '' : 's'}`);
      }
      if (hours > 0) {
        parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
      }
      if (minutes > 0) {
        parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
      }
      if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
      }

      return parts.join(', ');
    }
  }
});
