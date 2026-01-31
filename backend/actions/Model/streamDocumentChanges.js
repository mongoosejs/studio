'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const StreamDocumentChangesParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  documentId: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('StreamDocumentChangesParams');

module.exports = ({ db, changeStream }) => async function* streamDocumentChanges(params) {
  const { model, documentId, roles } = new StreamDocumentChangesParams(params);

  await authorize('Model.streamDocumentChanges', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  if (!changeStream) {
    throw new Error('Change streams are not enabled');
  }

  const collectionName = Model.collection.name;
  const targetId = String(documentId);

  const queue = [];
  let resolveQueue = null;
  let streamError = null;
  let streamEnded = false;

  function enqueue(payload) {
    queue.push(payload);
    if (resolveQueue) {
      const resolve = resolveQueue;
      resolveQueue = null;
      resolve();
    }
  }

  function handleChange(change) {
    if (!change || change.ns?.coll !== collectionName) {
      return;
    }
    if (!change.documentKey || change.documentKey._id == null) {
      return;
    }
    if (String(change.documentKey._id) !== targetId) {
      return;
    }

    enqueue({
      type: 'change',
      operationType: change.operationType,
      documentKey: change.documentKey,
      ns: change.ns,
      updateDescription: change.updateDescription,
      clusterTime: change.clusterTime
    });
  }

  function handleError(err) {
    streamError = err || new Error('Change stream error');
    enqueue({ type: 'error', message: streamError.message });
  }

  function handleEnd() {
    streamEnded = true;
    enqueue({ type: 'end' });
  }

  changeStream.on('change', handleChange);
  changeStream.on('error', handleError);
  changeStream.on('end', handleEnd);

  try {
    while (true) {
      if (streamError) {
        throw streamError;
      }

      if (queue.length === 0) {
        await new Promise(resolve => {
          resolveQueue = resolve;
        });
      }

      if (streamError) {
        throw streamError;
      }

      while (queue.length > 0) {
        const payload = queue.shift();
        if (payload?.type === 'end') {
          return;
        }
        yield payload;
      }

      if (streamEnded) {
        return;
      }
    }
  } finally {
    changeStream.off('change', handleChange);
    changeStream.off('error', handleError);
    changeStream.off('end', handleEnd);
    if (resolveQueue) {
      resolveQueue();
      resolveQueue = null;
    }
  }
};
