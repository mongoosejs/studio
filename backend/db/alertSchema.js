'use strict';

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  workspaceId: {
    type: String
  },
  name: {
    type: String
  },
  eventType: {
    type: String,
    required: true,
    enum: ['insert', 'update', 'delete', 'upsert']
  },
  database: {
    type: String
  },
  collection: {
    type: String
  },
  slackChannel: {
    type: String,
    required: true
  },
  templateText: {
    type: String,
    required: true
  },
  enabled: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = alertSchema;
