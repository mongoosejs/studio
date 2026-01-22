'use strict';

const mongoose = require('mongoose');

const caseReportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    $required: true,
    default: 'created',
    enum: ['created', 'in_progress', 'cancelled', 'resolved', 'archived']
  },
  documents: [{
    document: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'documentModel'
    },
    documentModel: {
      type: String,
      required: true
    },
    notes: {
      type: String
    }
  }],
  summary: {
    type: String
  },
  AISummary: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = caseReportSchema;
