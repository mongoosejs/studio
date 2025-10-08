'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const AddFieldParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  _id: {
    $type: Archetype.Any,
    $required: true
  },
  fieldName: {
    $type: 'string',
    $required: true
  },
  fieldValue: {
    $type: Archetype.Any,
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('AddFieldParams');

module.exports = ({ db }) => async function addField(params) {
  const { model, _id, fieldName, fieldValue, roles } = new AddFieldParams(params);

  await authorize('Model.updateDocument', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  // Create update object with the new field
  const update = { $set: { [fieldName]: fieldValue } };

  const doc = await Model.findByIdAndUpdate(
    _id, 
    update, 
    { 
      sanitizeFilter: true, 
      returnDocument: 'after', 
      overwriteImmutable: true, 
      runValidators: false,
      strict: false
    }
  );

  return { doc };
};
