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
  createdById: {
    type: mongoose.Schema.Types.ObjectId
  },
  createdBy: {
    name: String,
    email: String
  },
  lastEvaluatedAt: {
    type: Date
  }
}, { timestamps: true });

dashboardSchema.post(['find', 'findOne'], async function(docs) {
  const dashboards = Array.isArray(docs) ? docs : [docs];
  for (const dashboard of dashboards) {
    if (dashboard != null && dashboard.createdAt == null && dashboard._id?.getTimestamp) {
      dashboard.createdAt = dashboard._id.getTimestamp();
      await this.model.db.model('__Studio_Dashboard').updateOne(
        { _id: dashboard._id },
        { createdAt: dashboard._id.getTimestamp() },
        { overwriteImmutable: true }
      );
    }
  }
});

module.exports = dashboardSchema;
