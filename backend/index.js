'use strict';

const Actions = require('./actions');
const { applySpec } = require('extrovert');
const mongoose = require('mongoose');

const chatMessageSchema = require('./db/chatMessageSchema');
const chatThreadSchema = require('./db/chatThreadSchema');
const dashboardSchema = require('./db/dashboardSchema');
const alertSchema = require('./db/alertSchema');
const startAlertService = require('./alerts/startAlertService');

module.exports = function backend(db, studioConnection, options) {
  db = db || mongoose.connection;

  studioConnection = studioConnection ?? db;
  const Dashboard = studioConnection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage', chatMessageSchema, 'studio__chatMessages');
  const ChatThread = studioConnection.model('__Studio_ChatThread', chatThreadSchema, 'studio__chatThreads');
  studioConnection.model('__Studio_Alert', alertSchema, 'studio__alerts');

  let changeStream = null;
  if (options?.changeStream) {
    changeStream = db.watch([], { fullDocument: 'updateLookup' });
  }

  const actions = applySpec(Actions, { db, studioConnection, options, changeStream });
  actions.services = { changeStream };

  if (changeStream) {
    actions.services.alertService = startAlertService({ db, studioConnection, options, changeStream });
  }
  return actions;
};
