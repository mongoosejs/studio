'use strict';

const Backend = require('../backend');
const mongoose = require('mongoose');

const connection = mongoose.createConnection('mongodb://127.0.0.1:27017/studio_data_test');
const studioConnection = mongoose.createConnection('mongodb://127.0.0.1:27017/studio_conn_test');

const Test = connection.model('Test', new mongoose.Schema({ name: String }));

before(async function () {
  await connection.asPromise();
  await studioConnection.asPromise();

  await Test.deleteMany();
});

after(async function() {
  await connection.close();
  await studioConnection.close();
})

const actions = Backend(connection, studioConnection);

exports.actions = actions;
exports.connection = connection;
