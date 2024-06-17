'use strict';

const Actions = require('./actions');
const { applySpec } = require('extrovert');
const mongoose = require('mongoose');

const dashboardSchema = require('./db/dashboardSchema');

module.exports = function backend(db) {
  db = db || mongoose.connection;
  
  const Dashboard = db.model('__Studio_Dashboard', dashboardSchema, '__studio_dashboards');
  const doc = new Dashboard({
    name: 'Test',
    code: 'Test Code'
  });
  doc.save().then(res => console.log(res))
  const actions = applySpec(Actions, { db });
  return actions;
};