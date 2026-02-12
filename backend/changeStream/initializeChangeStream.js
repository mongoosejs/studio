'use strict';

const mongoose = require('mongoose');

module.exports = function initializeChangeStream(db, options) {
  let changeStream = null;
  if (options?.changeStream) {
    changeStream = db instanceof mongoose.Mongoose ? db.connection.watch() : db.watch();
  }

  return changeStream;
};
