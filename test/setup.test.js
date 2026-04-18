'use strict';

const Backend = require('../backend');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let replSet;

const connection = mongoose.createConnection();
const studioConnection = mongoose.createConnection();

const Test = connection.model('Test', new mongoose.Schema({ name: String }));

before(async function() {
  this.timeout(60000);

  let uri = 'mongodb://127.0.0.1:27017';

  if (process.env.GITHUB_ACTIONS) {

    replSet = await MongoMemoryReplSet.create({
      replSet: {
        name: 'rs0',
        count: 1
      },
      binary: {
        version: process.env.MONGOMS_VERSION || '8.0.0'
      }
    });

    uri = replSet.getUri();
    console.log('Created MongoDB Memory server', uri);
  }

  await connection.openUri(uri, { dbName: 'studio_data_test' });
  await studioConnection.openUri(uri, { dbName: 'studio_conn_test' });

  await Test.deleteMany();
});

afterEach(async function () {
  await Test.deleteMany();
});

after(async function() {
  if (actions?.services?.changeStream()) {
    await actions.services.changeStream().close().catch(() => {});
  }
  await connection.close();
  await studioConnection.close();
  if (replSet) {
    await replSet.stop();
  }
});

const actions = Backend(connection, studioConnection, { changeStream: true });

exports.actions = actions;
exports.connection = connection;
exports.studioConnection = studioConnection;
