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
    Math,
    objectIdRange
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

  throw new Error('Invalid search filter: must evaluate to an object');
};

function objectIdRange(start, end) {
  if (start instanceof Date) {
    start = ObjectId.createFromTime(start.getTime() / 1000);
  } else if (typeof start === 'string') {
    if (/^[a-fA-F0-9]{24}$/.test(start)) {
      start = new ObjectId(start);
    } else if (!Number.isNaN(new Date(start).valueOf())) {
      start = ObjectId.createFromTime(new Date(start).getTime() / 1000);
    } else {
      throw new Error('Invalid start');
    }
  }
  if (end instanceof Date) {
    end = ObjectId.createFromTime(end.getTime() / 1000);
  } else if (typeof end === 'string') {
    if (/^[a-fA-F0-9]{24}$/.test(end)) {
      end = new ObjectId(end);
    } else if (!Number.isNaN(new Date(end).valueOf())) {
      end = ObjectId.createFromTime(new Date(end).getTime() / 1000);
    } else {
      throw new Error('Invalid end');
    }
  }

  if (start != null && end != null) {
    return { $gte: start, $lte: end };
  }
  if (start != null) {
    return { $gte: start };
  }
  if (end != null) {
    return { $lte: end };
  }
  throw new Error('Invalid range: must have either start or end');
}
