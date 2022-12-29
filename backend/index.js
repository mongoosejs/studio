'use strict';

const Actions = require('./actions');
const { applySpec } = require('extrovert');
const mongoose = require('mongoose');

module.exports = function backend(db) {
  db = db || mongoose.connection;

  const actions = applySpec(Actions, { db });
  return actions;
};