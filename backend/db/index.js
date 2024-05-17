'use strict';

const mongoose = require('mongoose');

mongoose.set('toJSON', { virtuals: true, getters: true });
mongoose.set('toObject', { virtuals: true });

const connectionString = process.env.MONGODB_CONNECTION_STRING;
console.log('Connecting to', connectionString);

module.exports = function models(connection) {
  connection = connection ?? mongoose.createConnection(connectionString, {
    serverSelectionTimeoutMS: 5000
  });

  for (const [schemaName, schema] of Object.entries(schemas)) {
    // "accessTokenSchema" -> "AccessToken"
    const modelName = schemaName.charAt(0).toUpperCase() +
      schemaName.replace(/Schema$/, '').slice(1);
    connection.model(modelName, schema, modelName);
  }

  return connection;
};

const schemas = {};
schemas.dashboardSchema = require('./dashboardSchema');