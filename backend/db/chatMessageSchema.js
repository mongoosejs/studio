'use strict';

const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  chatThreadId: {
    type: 'ObjectId',
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  script: {
    type: String,
    required: false
  },
  toolCalls: [{
    toolName: String,
    input: mongoose.Schema.Types.Mixed,
    status: String
  }],
  executionResult: {
    output: mongoose.Schema.Types.Mixed,
    logs: String,
    error: String,
    dryRun: Boolean
  }
}, { timestamps: true });

module.exports = chatMessageSchema;
