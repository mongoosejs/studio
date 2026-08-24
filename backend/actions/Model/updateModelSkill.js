'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const UpdateModelSkillParams = new Archetype({
  modelName: {
    $type: 'string',
    $required: true
  },
  skills: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('UpdateModelSkillParams');

module.exports = ({ db, studioConnection }) => async function updateModelSkill(params) {
  const { modelName, skills, roles } = new UpdateModelSkillParams(params);

  await authorize('Model.updateModelSkill', roles);

  if (db.models[modelName] == null) {
    throw new Error(`Model ${modelName} not found`);
  }

  const ModelSkill = studioConnection.model('__Studio_ModelSkill');
  const doc = await ModelSkill.findOneAndUpdate(
    { modelName },
    { skills },
    { upsert: true, returnDocument: 'after', sanitizeFilter: true }
  );

  return { doc };
};
