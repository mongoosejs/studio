'use strict';

const Actions = require('./actions');
const { applySpec } = require('extrovert');
const mongoose = require('mongoose');

const dashboardSchema = require('./db/dashboardSchema');

module.exports = function backend(db) {
  db = db || mongoose.connection;
  
  const Dashboard = db.model('Studio_Dashboard', dashboardSchema, 'studio__dashboards');
  const actions = applySpec(Actions, { db });
  return actions;
};