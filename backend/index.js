'use strict';

const Actions = require('./actions');
const ModelContainer = require('./modelContainer');
const { applySpec } = require('extrovert');
const mongoose = require('mongoose');

const chatMessageSchema = require('./db/chatMessageSchema');
const chatThreadSchema = require('./db/chatThreadSchema');
const dashboardSchema = require('./db/dashboardSchema');
const dashboardResultSchema = require('./db/dashboardResultSchema');

module.exports = function backend(db, studioConnection, options) {
  db = db || mongoose.connection;
  if (db instanceof mongoose.Mongoose) {
    db = db.connection;
  }

  let isMultiConnection = false;
  if (Array.isArray(db)) {
    studioConnection = db[0];
    db = new ModelContainer(db);
    isMultiConnection = true;
  } else {
    studioConnection = db;
  }

  const Dashboard = studioConnection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');
  const DashboardResult = studioConnection.model('__Studio_DashboardResult', dashboardResultSchema, 'studio__dashboardResults');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage', chatMessageSchema, 'studio__chatMessages');
  const ChatThread = studioConnection.model('__Studio_ChatThread', chatThreadSchema, 'studio__chatThreads');

  let changeStream = null;
  if (options?.changeStream) {
    if (isMultiConnection) {
      throw new Error('changeStream is not supported for multi-connection, disable changeStream option');
    }
    const conn = db.connection ? db.connection : db;
    if (conn.readyState !== mongoose.Connection.STATES.connected) {
      conn._waitForConnect().then(() => {
        changeStream = conn.watch();
      });
    } else {
      changeStream = conn.watch();
    }
  }

  const actions = applySpec(Actions, {
    db,
    studioConnection,
    options,
    changeStream: () => changeStream
  });
  actions.services = { changeStream: () => changeStream };
  return actions;
};
