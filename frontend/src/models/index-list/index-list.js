'use strict';

const api = require('../../api');
const template = require('./index-list.html');

module.exports = app => app.component('index-list', {
  template: template,
  props: ['currentModel'],
  emits: ['close'],
  data: () => ({
    mongoDBIndexes: null,
    diffIndexes: null,
    expandedIndexes: new Set()
  }),
  async mounted() {
    const { mongoDBIndexes, diffIndexes } = await api.Model.getIndexes({ model: this.currentModel });
    this.mongoDBIndexes = mongoDBIndexes;
    this.diffIndexes = diffIndexes;
  },
  methods: {
    toggleIndex(name) {
      if (this.expandedIndexes.has(name)) {
        this.expandedIndexes.delete(name);
      } else {
        this.expandedIndexes.add(name);
      }
    },
    async createIndex(key, options) {
      const { mongoDBIndexes, diffIndexes } = await api.Model.createIndex({ model: this.currentModel, key, options });
      this.mongoDBIndexes = mongoDBIndexes;
      this.diffIndexes = diffIndexes;
      this.$toast.success('Index created!');
    },
    async dropIndex(name) {
      const { mongoDBIndexes, diffIndexes } = await api.Model.dropIndex({ model: this.currentModel, name });
      this.mongoDBIndexes = mongoDBIndexes;
      this.diffIndexes = diffIndexes;
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
