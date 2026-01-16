'use strict';

const Archetype = require('archetype');
const { EJSON } = require('mongoose').mongo.BSON;
const authorize = require('../../authorize');

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
  }
}).compile('CreateDocumentParams');

module.exports = ({ db }) => async function CreateDocument(params) {
  const { model, data, roles } = new CreateDocumentParams(params);

  await authorize('Model.createDocument', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.create(EJSON.deserialize(data));
  console.log('pinging backend');
  const res = await fetch(`${mothershipUrl}/notifySlack`, {
    method: 'POST',
    body: JSON.stringify({ purpose: 'documentCreate', modelName: model, documentId: doc._id }),
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json'
    }
  })
    .then(response => {
      if (response.status < 200 || response.status >= 400) {
        return response.json().then(data => {
          throw new Error(`Mongoose Studio API Key Error ${response.status}: ${require('util').inspect(data)}`);
        });
      }
      return response;
    })
    .then(res => res.json());

    console.log('waht is res', res);

  return { doc };
};
