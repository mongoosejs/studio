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
    expandedIndexes: new Set(),
    createdIndexNames: new Set(),
    indexToDrop: null,
    dropIndexConfirmName: '',
    syncPlan: null,
    syncEvents: null,
    syncStatus: null
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
      const { indexName, mongoDBIndexes, diffIndexes } = await api.Model.createIndex({ model: this.currentModel, key, options });
      this.mongoDBIndexes = mongoDBIndexes;
      this.diffIndexes = diffIndexes;
      this.createdIndexNames.add(indexName);
    },
    openDropIndexModal(name) {
      this.indexToDrop = name;
      this.dropIndexConfirmName = '';
      this.$nextTick(() => this.$refs.dropIndexConfirmInput.focus());
    },
    async dropIndex(name) {
      const { mongoDBIndexes, diffIndexes } = await api.Model.dropIndex({ model: this.currentModel, name });
      this.mongoDBIndexes = mongoDBIndexes;
      this.diffIndexes = diffIndexes;
      this.expandedIndexes.delete(name);
      this.indexToDrop = null;
      this.$toast.success('Index dropped!');
    },
    openSyncIndexesModal() {
      this.syncPlan = this.diffIndexes;
      this.syncEvents = { toDrop: [], toCreate: [] };
      this.syncStatus = 'confirm';
    },
    async syncIndexes() {
      this.syncStatus = 'inProgress';
      const { toCreate, toDrop } = this.syncPlan;
      try {
        for await (const event of api.Model.syncIndexes({ model: this.currentModel, toCreate, toDrop })) {
          this.syncEvents[event.list][event.position] = event;
        }
      } finally {
        // Refresh here rather than from the stream, which may have been cut off mid sync
        this.syncStatus = 'finished';
        const { mongoDBIndexes, diffIndexes } = await api.Model.getIndexes({ model: this.currentModel });
        this.mongoDBIndexes = mongoDBIndexes;
        this.diffIndexes = diffIndexes;
      }

      const created = this.syncEvents.toCreate.filter(event => event.status === 'succeeded');
      created.forEach(event => this.createdIndexNames.add(event.name));

      // Otherwise leave the modal open so the user can see which indexes didn't sync
      const dropped = this.syncEvents.toDrop.filter(event => event.status === 'succeeded');
      if (created.length === toCreate.length && dropped.length === toDrop.length) {
        this.syncPlan = null;
        this.$toast.success('Indexes synced!');
      }
    },
    getPhasePercent({ status, phases }, phase) {
      // Progress is polled, so the last update for a finished phase may be short of 100%
      const names = Object.keys(phases);
      if (status === 'succeeded' || phase !== names[names.length - 1]) {
        return 100;
      }
      return Math.floor(100 * phases[phase].done / phases[phase].total);
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
