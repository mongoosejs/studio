'use strict';

const mongoose = require('mongoose');
const vm = require('vm');

const evaluate = typeof vm.evaluate === 'function' ?
  vm.evaluate.bind(vm) :
  (code, context) => {
    const script = new vm.Script(code, { displayErrors: true });
    return script.runInContext(context, { timeout: 1000 });
  };

const ObjectId = new Proxy(mongoose.Types.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

module.exports = function evaluateFilter(searchText) {
  if (searchText == null) {
    return null;
  }

  const normalized = String(searchText);
  if (normalized.trim().length === 0) {
    return null;
  }

  const context = vm.createContext({
    ObjectId,
    Date,
    Math
  });

  let result;
  try {
    result = evaluate(`(${normalized})`, context);
  } catch (err) {
    throw new Error(`Invalid search filter: ${err.message}`);
  }

  if (result == null) {
    return result;
  }

  if (typeof result === 'object') {
    return result;
  }

  if (typeof result === 'string') {
    return { '$**': result };
  }

  throw new Error('Invalid search filter: must evaluate to an object or string');
};
