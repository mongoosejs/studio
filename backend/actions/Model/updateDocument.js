'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

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
  unset: {
    $type: Object
  },
  roles: {
    $type: ['string']
  }
}).compile('UpdateDocumentsParams');

module.exports = ({ db }) => async function updateDocument(params) {
  const { model, _id, update, unset, roles } = new UpdateDocumentsParams(params);

  await authorize('Model.updateDocument', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const setFields = {};
  const unsetFields = unset || {};

  if (Object.keys(update).length > 0) {
    Object.entries(update).forEach(([key, value]) => {
      if (value === '') {
        // Treat empty strings as undefined - unset the field
        unsetFields[key] = 1;
      } else {
        setFields[key] = value;
      }
    });
  }

  // Build the update operation with both $set and $unset
  const updateOperation = {};
  if (Object.keys(setFields).length > 0) {
    updateOperation.$set = setFields;
  }
  if (Object.keys(unsetFields).length > 0) {
    updateOperation.$unset = unsetFields;
  }

  const doc = await Model.
    findByIdAndUpdate(_id, updateOperation, { sanitizeFilter: true, returnDocument: 'after', overwriteImmutable: true, runValidators: false });
  return { doc };
};
