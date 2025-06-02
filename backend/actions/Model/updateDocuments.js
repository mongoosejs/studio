'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

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
  },
  roles: {
    $type: ['string'],
  }
}).compile('UpdateDocumentsParams');

module.exports = ({ db }) => async function updateDocuments(params) {
  const { model, _id, update, roles } = new UpdateDocumentsParams(params);

  if (roles && roles.includes('readonly')) {
    throw new Error('Not authorized');
  }
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

  console.log({ _id: { $in: _id }})
  const result = await Model.
    updateMany({ _id: { $in: _id }}, processedUpdate, { sanitizeFilter: true, overwriteImmutable: true, runValidators: false });
  
  return { result };
};