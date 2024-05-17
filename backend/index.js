'use strict';

const Actions = require('./actions');
const { applySpec } = require('extrovert');
const mongoose = require('mongoose');

const dashboardSchema = require('./db/dashboardSchema');

module.exports = function backend(db) {
  db = db || mongoose.connection;
  
  db.model('__Studio_Dashboard', dashboardSchema, '__studio_dashboards');
  
  const actions = applySpec(Actions, { db });
  return actions;
};