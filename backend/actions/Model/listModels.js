'use strict';

module.exports = ({ db }) => async function listModels() {
  return {
    models: Object.keys(db.models).filter(key => !key.startsWith('__Studio_')).sort()
  };
};