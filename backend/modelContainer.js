'use strict';

module.exports = class ModelContainer {
  constructor(connectionsWithNames) {
    this.models = {};
    let count = 0;
    for (const connectionWithName of connectionsWithNames) {
      ++count;
      if (!connectionWithName.name) {
        connectionWithName.name = 'Connection ' + count;
      }
      for (const model of Object.values(connectionWithName.connection.models)) {
        model.$connectionName = connectionWithName.name;
      }
      this.models = { ...this.models, ...connectionWithName.connection.models };
    }
  }

  model(modelName) {
    return this.models[modelName];
  }
};
