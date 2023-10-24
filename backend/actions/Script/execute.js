'use strict';

const Archetype = require('archetype');

const ExecuteParams = new Archetype({
  code: {
    $type: 'string',
    $required: true
  }
}).compile('ExecuteParams');

module.exports = ({ db }) => async function execute(params) {
  const { code } = new ExecuteParams(params);

  const res = eval(code);

  return {
    res
  };
};