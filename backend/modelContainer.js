'use strict';

module.exports = class ModelContainer {
  constructor(connectionsWithNames) {
    this.models = {};
    for (const { connection, name } of connectionsWithNames) {
      for (const model of connection.models) {
        model.$connectionName = name;
      }
      this.models = { ...this.models, ...connection.models };
    }
  }
}
