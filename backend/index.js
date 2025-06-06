'use strict';

const Actions = require('./actions');
const { applySpec } = require('extrovert');
const mongoose = require('mongoose');

const chatMessageSchema = require('./db/chatMessageSchema');
const chatThreadSchema = require('./db/chatThreadSchema');
const dashboardSchema = require('./db/dashboardSchema');

const getModelDescriptions = require('./helpers/getModelDescriptions');

module.exports = function backend(db) {
  db = db || mongoose.connection;

  const Dashboard = db.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');
  const ChatMessage = db.model('__Studio_ChatMessage', chatMessageSchema, 'studio__chatMessages');
  const ChatThread = db.model('__Studio_ChatThread', chatThreadSchema, 'studio__chatThreads');

  const actions = applySpec(Actions, { db });
  return actions;
};
