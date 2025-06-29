'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const GetDocumentsParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('GetDocumentsParams');

module.exports = ({ db }) => async function getIndexes(params) {
  const { model, roles } = new GetDocumentsParams(params);

  await authorize('Model.getIndexes', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const mongoDBIndexes = await Model.listIndexes();
  const schemaIndexes = Model.schema.indexes().map(([fields, options]) => ({
    key: fields,
    name: Object.keys(fields).map(key => `${key}_${fields[key]}`).join('_')
  }));
  const diffIndexes = await Model.diffIndexes();
  return {
    mongoDBIndexes,
    schemaIndexes,
    diffIndexes
  };
};
