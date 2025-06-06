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
  executionResult: {
    output: mongoose.Schema.Types.Mixed,
    logs: String,
    error: String
  }
}, { timestamps: true });

module.exports = chatMessageSchema;
