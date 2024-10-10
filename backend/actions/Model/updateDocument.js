'use strict';

const Archetype = require('archetype');

const UpdateDocumentsParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  _id: {
    $type: Archetype.Any,
    $required: true
  },
  update: {
    $type: Object,
    $required: true
  }
}).compile('UpdateDocumentsParams');

module.exports = ({ db }) => async function updateDocument(params) {
  const { model, _id, update } = new UpdateDocumentsParams(params);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  let processedUpdate = update;
  if (Object.keys(update).length > 0) {
    processedUpdate = Object.fromEntries(
      Object.entries(update).map(([key, value]) => [key, value === 'null' ? null : value === 'undefined' ? undefined : value])
    );
  }

  const doc = await Model.
    findByIdAndUpdate(_id, processedUpdate, { sanitizeFilter: true, returnDocument: 'after', overwriteImmutable: true, runValidators: false });
  
  return { doc };
};