'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');
const { EJSON } = require('mongoose').mongo.BSON;
const authorize = require('../../authorize');
const callMothership = require('../../integrations/callMothership');

const CreateDocumentParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  data: {
    $type: Archetype.Any,
    $required: true
  },
  roles: {
    $type: ['string']
  },
  $workspaceId: {
    $type: mongoose.Types.ObjectId,
  }
}).compile('CreateDocumentParams');

module.exports = ({ db, options }) => async function CreateDocument(params) {
  const { model, data, roles, $workspaceId } = new CreateDocumentParams(params);
  await authorize('Model.createDocument', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.create(EJSON.deserialize(data));
  
  try {
    const res = await callMothership('/notifySlack', {
      purpose: 'documentCreated',
      modelName: model,
      documentId: doc._id,
      workspaceId: $workspaceId
    }, options);
    console.log('what is res', res);
  } catch (err) {
    console.error('Error calling mothership:', err);
    // Continue execution even if mothership call fails
  }

  return { doc };
};
