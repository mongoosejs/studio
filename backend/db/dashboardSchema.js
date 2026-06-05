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
    type: Boolean,
    default: false
  }
});

module.exports = dashboardSchema;
