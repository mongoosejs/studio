'use strict';

const mongoose = require('mongoose');

const uri = 'mongodb://127.0.0.1:27017/mongoose_studio_test';

module.exports = async function connect() {
  await mongoose.connect(uri);

  mongoose.model('User', new mongoose.Schema({
    name: String,
    email: String,
    role: String,
    plan: String,
    status: String,
    isDeleted: Boolean,
    lastLoginAt: Date,
    createdAt: Date,
    updatedAt: Date
  }, { collection: 'User' }));

  return mongoose.connection;
};
