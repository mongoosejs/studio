'use strict';

const mongoose = require('mongoose');

const dashboardResultSchema = new mongoose.Schema({
  dashboardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: '__Studio_Dashboard',
    required: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId
  },
  startedEvaluatingAt: {
    type: Date
  },
  finishedEvaluatingAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'failed'],
    required: true
  },
  error: new mongoose.Schema({
    message: String,
    extra: String
  }, { _id: false }),
  result: mongoose.Schema.Types.Mixed
}, { timestamps: true });

dashboardResultSchema.index({ dashboardId: 1, workspaceId: 1, createdAt: -1 });

module.exports = dashboardResultSchema;
