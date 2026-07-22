'use strict';

const mongoose = require('mongoose');

const dashboardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  isPinned: {
    type: Boolean
  },
  createdById: {
    type: mongoose.Schema.Types.ObjectId
  },
  createdBy: new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true }
  }, { _id: false }),
  lastEvaluatedAt: {
    type: Date
  }
}, { timestamps: true });

dashboardSchema.post(['find', 'findOne'], async function(docs) {
  const dashboards = Array.isArray(docs) ? docs : [docs];
  for (const dashboard of dashboards) {
    if (dashboard != null && dashboard.createdAt == null && dashboard._id?.getTimestamp) {
      const createdAt = dashboard._id.getTimestamp();
      if (!createdAt.valueOf()) {
        continue;
      }
      dashboard.set('createdAt', createdAt, { overwriteImmutable: true });
      await this.model.db.model('__Studio_Dashboard').updateOne(
        { _id: dashboard._id },
        { createdAt },
        { overwriteImmutable: true }
      );
    }
  }
});

module.exports = dashboardSchema;
