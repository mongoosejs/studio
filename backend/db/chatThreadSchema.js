'use strict';

const mongoose = require('mongoose');

const chatThreadSchema = new mongoose.Schema({
  title: {
    type: String
  },
  userId: {
    type: mongoose.ObjectId,
    ref: 'User'
  },
  dashboardId: {
    type: mongoose.ObjectId,
    ref: 'Dashboard'
  },
  workspaceId: {
    type: mongoose.ObjectId,
    ref: 'Workspace'
  },
  sharingOptions: {
    sharedWithWorkspace: {
      type: Boolean,
      default: false
    }
  }
}, { timestamps: true });

module.exports = chatThreadSchema;
