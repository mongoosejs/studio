'use strict';

const mongoose = require('mongoose');
const vm = require('vm');

const dashboardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  description: {
    type: String
  }
});

dashboardSchema.methods.evaluate = async function evaluate() {
  const context = vm.createContext({ db: this.constructor.db });
  let result = null;
  result = await vm.runInContext(formatFunction(this.code), context);
  if (result.$document?.constructor?.modelName) {
    let schemaPaths = {};
    const Model = this.constructor.db.model(result.$document?.constructor?.modelName);
    for (const path of Object.keys(Model.schema.paths)) {
      schemaPaths[path] = {
        instance: Model.schema.paths[path].instance,
        path,
        ref: Model.schema.paths[path].options?.ref,
        required: Model.schema.paths[path].options?.required
      };
    }
    result.$document.schemaPaths = schemaPaths;
  }

  return result;
};

module.exports = dashboardSchema;

const formatFunction = code => `(async function() {
  ${code}
})();`