'use strict';

const collectionMethodOptionsIndex = new Map([
  ['bulkWrite', 1],
  ['countDocuments', 1],
  ['createIndex', 1],
  ['createIndexes', 1],
  ['deleteMany', 1],
  ['deleteOne', 1],
  ['distinct', 2],
  ['drop', 0],
  ['dropIndex', 1],
  ['dropIndexes', 0],
  ['estimatedDocumentCount', 0],
  ['find', 1],
  ['findOne', 1],
  ['findOneAndDelete', 1],
  ['findOneAndReplace', 2],
  ['findOneAndUpdate', 2],
  ['insertMany', 1],
  ['insertOne', 1],
  ['rename', 1],
  ['replaceOne', 2],
  ['updateMany', 2],
  ['updateOne', 2]
]);

function createScriptDb(db) {
  const sourceConnection = db?.connection?.useDb ? db.connection : db;
  if (typeof sourceConnection?.useDb !== 'function') {
    return createPassthroughScriptDb(db);
  }

  const scriptConnection = sourceConnection.useDb(sourceConnection.name, { useCache: false });
  scriptConnection.options = { ...(scriptConnection.options ?? {}) };

  let dryRunSession = null;
  cloneModels(sourceConnection, scriptConnection, () => dryRunSession);

  const originalDebug = sourceConnection.options?.debug;
  scriptConnection.set('debug', function() {
    if (typeof originalDebug === 'function') {
      return originalDebug.apply(this, arguments);
    }
  });

  return {
    db: scriptConnection,
    setDryRunSession(session) {
      dryRunSession = session;
    },
    async close() {
      await closeUseDbConnection(sourceConnection, scriptConnection);
    }
  };
}

function createPassthroughScriptDb(db) {
  return {
    db,
    setDryRunSession() {},
    async close() {}
  };
}

function cloneModels(sourceConnection, scriptConnection, getSession) {
  for (const Model of Object.values(sourceConnection.models ?? {})) {
    if (Model?.schema == null || typeof scriptConnection.model !== 'function') {
      continue;
    }

    const ClonedModel = scriptConnection.model(Model.modelName, Model.schema, getCollectionName(Model));
    wrapModelCollections(ClonedModel, getSession);
  }
}

function getCollectionName(Model) {
  return Model.collection?.collectionName ?? Model.collection?.name ?? Model.$__collection?.collectionName;
}

function wrapModelCollections(Model, getSession) {
  const collection = Model?.collection ?? Model?.$__collection;
  if (collection == null) {
    return;
  }

  const wrappedCollection = wrapCollection(collection, getSession);
  Model.collection = wrappedCollection;
  Model.$__collection = wrappedCollection;

  if (Model.prototype != null) {
    Model.prototype.collection = wrappedCollection;
    Model.prototype.$collection = wrappedCollection;
    setModelCollectionSymbols(Model.prototype, wrappedCollection);
  }
}

function setModelCollectionSymbols(target, collection) {
  for (const symbol of Object.getOwnPropertySymbols(target)) {
    if (symbol.description === 'mongoose#Model#collection') {
      target[symbol] = collection;
    }
  }
}

function wrapCollection(collection, getSession) {
  const wrapped = Object.create(collection);
  for (const [methodName, optionsIndex] of collectionMethodOptionsIndex) {
    const method = collection[methodName];
    if (typeof method !== 'function') {
      continue;
    }

    wrapped[methodName] = function() {
      const args = addSessionOption(Array.from(arguments), optionsIndex, getSession());
      return method.apply(collection, args);
    };
  }
  return wrapped;
}

function addSessionOption(args, optionsIndex, session) {
  if (session == null) {
    return args;
  }

  while (args.length < optionsIndex) {
    args.push(undefined);
  }

  const options = args[optionsIndex];
  if (options != null && typeof options !== 'object') {
    return args;
  }

  if (options?.session != null) {
    return args;
  }

  args[optionsIndex] = { ...(options ?? {}), session };
  return args;
}

async function closeUseDbConnection(sourceConnection, scriptConnection) {
  if (Array.isArray(sourceConnection.otherDbs)) {
    sourceConnection.otherDbs = sourceConnection.otherDbs.filter(db => db !== scriptConnection);
  }
  if (Array.isArray(scriptConnection.otherDbs)) {
    scriptConnection.otherDbs = [];
  }
  if (sourceConnection.relatedDbs?.[scriptConnection.name] === scriptConnection) {
    delete sourceConnection.relatedDbs[scriptConnection.name];
  }

  if (typeof scriptConnection.close === 'function') {
    await scriptConnection.close({ force: false, skipCloseClient: true });
  }
}

module.exports = {
  createScriptDb,
  collectionMethodOptionsIndex
};
