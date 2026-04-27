'use strict';

const Actions = require('./actions');
const { applySpec } = require('extrovert');
const mongoose = require('mongoose');

const chatMessageSchema = require('./db/chatMessageSchema');
const chatThreadSchema = require('./db/chatThreadSchema');
const dashboardSchema = require('./db/dashboardSchema');
const caseReportSchema = require('./db/caseReportSchema');
const dashboardResultSchema = require('./db/dashboardResultSchema');

module.exports = function backend(db, studioConnection, options) {
  db = db || mongoose.connection;

  studioConnection = studioConnection ?? db;
  const Dashboard = studioConnection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');
  const DashboardResult = studioConnection.model('__Studio_DashboardResult', dashboardResultSchema, 'studio__dashboardResults');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage', chatMessageSchema, 'studio__chatMessages');
  const ChatThread = studioConnection.model('__Studio_ChatThread', chatThreadSchema, 'studio__chatThreads');
  const CaseReport = studioConnection.model('__Studio_CaseReport', caseReportSchema, 'studio__caseReports');

  let changeStream = null;
  if (options?.changeStream) {
    const conn = db instanceof mongoose.Mongoose ? db.connection : db;
    if (conn.readyState !== mongoose.Connection.STATES.connected) {
      conn._waitForConnect().then(() => {
        changeStream = conn.watch();
      });
    } else {
      changeStream = conn.watch();
    }

  }

  const actions = applySpec(Actions, { db, studioConnection, options, changeStream: () => changeStream });
  actions.services = { changeStream: () => changeStream };
  return actions;
};
