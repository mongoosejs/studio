'use strict';

const Actions = require('./actions');
const { applySpec } = require('extrovert');
const mongoose = require('mongoose');
const localDb = require('./db');

module.exports = function backend(db) {
  db = db || mongoose.connection;
  db = localDb(db);
  const actions = applySpec(Actions, { db });
  return actions;
};