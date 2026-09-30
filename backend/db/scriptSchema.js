'use strict';

const mongoose = require('mongoose');

const scriptSchema = new mongoose.Schema({
  script: {
    type: String,
    required: true
  },
  executionResult: new mongoose.Schema({
    output: mongoose.Schema.Types.Mixed,
    logs: String,
    error: String
  }, { _id: false }),
  userId: {
    type: mongoose.Schema.Types.ObjectId
  },
  dryRun: {
    type: Boolean
  },
  executionStartedAt: {
    type: Date
  },
  executionFinishedAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = scriptSchema;
