'use strict';

const Backend = require('../backend');
const mongoose = require('mongoose');

let replSet;

const connection = mongoose.createConnection();
const studioConnection = mongoose.createConnection();

const Test = connection.model('Test', new mongoose.Schema({ name: String }));

before(async function() {
  this.timeout(60000);

  let dataUri = 'mongodb://127.0.0.1:27017/studio_data_test';
  let connUri = 'mongodb://127.0.0.1:27017/studio_conn_test';

  if (process.env.GITHUB_ACTIONS) {
    const { MongoMemoryReplSet } = require('mongodb-memory-server');
    replSet = await MongoMemoryReplSet.create({
      replSet: {
        name: 'rs0',
        count: 1
      },
      binary: {
        version: process.env.MONGOMS_VERSION || '8.0.0'
      }
    });

    const uri = replSet.getUri();
    dataUri = uri + 'studio_data_test';
    connUri = uri + 'studio_conn_test';
  }

  await connection.openUri(dataUri);
  await studioConnection.openUri(connUri);

  await Test.deleteMany();
});

afterEach(async function () {
  await Test.deleteMany();
});

after(async function() {
  if (actions?.services?.changeStream) {
    await actions.services.changeStream.close().catch(() => {});
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
