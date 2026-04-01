'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mpath = require('mpath');
const { EJSON } = require('mongoose').mongo.BSON;

const PullDocumentValuesParams = new Archetype({
  pulls: {
    $type: Archetype.Any,
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('PullDocumentValuesParams');

module.exports = ({ db }) => async function pullDocumentValues(params) {
  const { pulls, roles } = new PullDocumentValuesParams(params);

  await authorize('Model.pullDocumentValues', roles);

  if (!Array.isArray(pulls) || pulls.length === 0) {
    throw new Error('pulls must be a non-empty array');
  }
  for (const p of pulls) {
    if (p == null || typeof p !== 'object') {
      throw new Error('Each pull must be an object');
    }
    if (typeof p.sourceModel !== 'string' || typeof p.sourceDocumentId !== 'string') {
      throw new Error('Each pull must have sourceModel and sourceDocumentId strings');
    }
    if (typeof p.sourcePath !== 'string' || typeof p.targetPath !== 'string') {
      throw new Error('Each pull must have sourcePath and targetPath strings');
    }
    if (!p.sourceModel.trim() || !p.sourceDocumentId.trim() || !p.sourcePath.trim() || !p.targetPath.trim()) {
      throw new Error('sourceModel, sourceDocumentId, sourcePath, and targetPath must be non-empty');
    }
  }

  const leanCache = new Map();

  async function getLean(sourceModel, sourceDocumentId) {
    const key = `${sourceModel}:${sourceDocumentId}`;
    if (leanCache.has(key)) {
      return leanCache.get(key);
    }
    const Model = db.models[sourceModel];
    if (Model == null) {
      throw new Error(`Model ${sourceModel} not found`);
    }
    const doc = await Model.findById(sourceDocumentId).setOptions({ sanitizeFilter: true }).orFail();
    const lean = doc.toObject({ virtuals: false, getters: true });
    leanCache.set(key, lean);
    return lean;
  }

  const values = {};
  for (const pull of pulls) {
    const lean = await getLean(pull.sourceModel.trim(), pull.sourceDocumentId.trim());
    const v = mpath.get(pull.sourcePath, lean);
    if (v !== undefined) {
      mpath.set(pull.targetPath, v, values);
    }
  }

  return { values: EJSON.serialize(values) };
};
