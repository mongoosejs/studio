'use strict';

const Archetype = require('archetype');
const util = require('util');
const vm = require('vm');

const ExecuteParams = new Archetype({
  code: {
    $type: 'string',
    $required: true
  }
}).compile('ExecuteParams');

module.exports = ({ db }) => async function execute(params) {
  const { code } = new ExecuteParams(params);

  const script = new vm.Script(formatFunction(code));
  const res = await script.runInNewContext({ db });

  return {
    asString: util.inspect(res, { depth: 10 })
  };
};

const formatFunction = code => code.indexOf('\n') === -1 && code.indexOf(';') === -1 ? `(async () => ${code})();` : `(async function() {
  ${code}
})();`
