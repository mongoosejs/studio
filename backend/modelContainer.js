'use strict';

module.exports = class ModelContainer {
  constructor(connections) {
    this.models = {};
    for (const connection of connections) {
      this.models = { ...this.models, ...connection.models };
    }
  }
}
