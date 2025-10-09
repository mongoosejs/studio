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
  const context = vm.createContext({ db: this.constructor.db, setTimeout, ObjectId: mongoose.Types.ObjectId });
  let result = null;
  result = await vm.runInContext(formatFunction(this.code), context);
  if (result.$document?.constructor?.modelName) {
    const schemaPaths = {};
    const Model = this.constructor.db.model(result.$document?.constructor?.modelName);
    for (const path of Object.keys(Model.schema.paths)) {
      const schemaPath = Model.schema.paths[path];
      const rawEnumValues = Array.isArray(schemaPath?.options?.enum) && schemaPath.options.enum.length > 0 ?
        schemaPath.options.enum : schemaPath?.enumValues;
      const enumValues = Array.isArray(rawEnumValues) ? rawEnumValues.filter(value => value != null) : undefined;
      schemaPaths[path] = {
        instance: schemaPath.instance,
        path,
        ref: schemaPath.options?.ref,
        required: schemaPath.options?.required,
        enumValues: Array.isArray(enumValues) && enumValues.length > 0 ? enumValues : undefined
      };
    }
    result.$document.schemaPaths = schemaPaths;
  }

  return result;
};

module.exports = dashboardSchema;

const formatFunction = code => `(async function() {
  ${code}
})();`;
