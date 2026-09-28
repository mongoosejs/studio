'use strict';

const omitNullish = require('../helpers/omitNullish');

const wrappedCollections = new WeakSet();

// Read preference only applies to reads, so it is injected for these methods
// only. Applying it to a write would be meaningless at best and rejected by the
// driver at worst.
const readMethods = new Set([
  'aggregate',
  'countDocuments',
  'distinct',
  'estimatedDocumentCount',
  'find',
  'findOne',
  'listIndexes'
]);

const collectionMethodOptionsIndex = new Map([
  ['aggregate', 1],
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
  ['listIndexes', 0],
  ['rename', 1],
  ['replaceOne', 2],
  ['updateMany', 2],
  ['updateOne', 2]
]);

function createScriptDb(db, options = {}) {
  const sourceConnection = db;

  const scriptConnection = sourceConnection.useDb(sourceConnection.name, { useCache: false });
  // Mongoose useDb() shares the source connection's options object. Copy it
  // before setting sandbox-only options so the application connection remains untouched.
  scriptConnection.options = { ...scriptConnection.options };
  scriptConnection.config = {
    ...scriptConnection.config,
    autoCreate: false,
    autoIndex: false
  };
  if (options.maxTimeMS != null) {
    scriptConnection.set('maxTimeMS', options.maxTimeMS);
  }

  let dryRunSession = null;
  const getOperationOptions = () => ({
    session: dryRunSession,
    maxTimeMS: options.maxTimeMS,
    readPreference: options.readPreference
  });
  cloneModels(sourceConnection, scriptConnection, getOperationOptions);
  wrapCollectionAccessors(scriptConnection, getOperationOptions);

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
    close() {
      if (Array.isArray(sourceConnection.otherDbs)) {
        sourceConnection.otherDbs = sourceConnection.otherDbs.filter(db => db !== scriptConnection);
      }
      if (Array.isArray(scriptConnection.otherDbs)) {
        scriptConnection.otherDbs = [];
      }
      if (sourceConnection.relatedDbs?.[scriptConnection.name] === scriptConnection) {
        delete sourceConnection.relatedDbs[scriptConnection.name];
      }
    }
  };
}

function cloneModels(sourceConnection, scriptConnection, getOperationOptions) {
  for (const Model of Object.values(sourceConnection.models ?? {})) {
    if (Model?.schema == null || typeof scriptConnection.model !== 'function') {
      continue;
    }

    const ClonedModel = scriptConnection.model(Model.modelName, Model.schema, getCollectionName(Model));
    wrapModelCollections(ClonedModel, getOperationOptions);
  }
}

function getCollectionName(Model) {
  return Model.collection?.collectionName ?? Model.collection?.name ?? Model.$__collection?.collectionName;
}

function wrapModelCollections(Model, getOperationOptions) {
  const collection = Model?.collection ?? Model?.$__collection;
  if (collection == null) {
    return;
  }

  const wrappedCollection = wrapCollection(collection, getOperationOptions);
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

function wrapCollectionAccessors(scriptConnection, getOperationOptions) {
  const wrappedCollectionCache = new WeakMap();

  const nativeDb = scriptConnection.db;
  const originalDbCollection = nativeDb != null && typeof nativeDb.collection === 'function'
    ? nativeDb.collection
    : null;

  if (typeof scriptConnection.collection === 'function') {
    const originalConnectionCollection = scriptConnection.collection;
    scriptConnection.collection = function() {
      const collection = originalConnectionCollection.apply(this, arguments);
      if (collection != null && originalDbCollection != null && collection.name != null) {
        if (collection.collection == null || wrappedCollections.has(collection.collection)) {
          collection.collection = originalDbCollection.call(nativeDb, collection.name);
        }
      }
      return getOrCreateWrappedCollection(wrappedCollectionCache, collection, getOperationOptions);
    };
  }

  if (originalDbCollection != null) {
    nativeDb.collection = function() {
      const collection = originalDbCollection.apply(this, arguments);
      return getOrCreateWrappedCollection(wrappedCollectionCache, collection, getOperationOptions);
    };
  }
}

function getOrCreateWrappedCollection(cache, collection, getOperationOptions) {
  if (collection == null || (typeof collection !== 'object' && typeof collection !== 'function')) {
    return collection;
  }
  if (wrappedCollections.has(collection)) {
    return collection;
  }
  if (cache.has(collection)) {
    return cache.get(collection);
  }
  const wrapped = wrapCollection(collection, getOperationOptions);
  cache.set(collection, wrapped);
  return wrapped;
}

function wrapCollection(collection, getOperationOptions) {
  if (wrappedCollections.has(collection)) {
    return collection;
  }
  const wrapped = Object.create(collection);
  wrappedCollections.add(wrapped);
  for (const [methodName, optionsIndex] of collectionMethodOptionsIndex) {
    const method = collection[methodName];
    if (typeof method !== 'function') {
      continue;
    }

    wrapped[methodName] = function() {
      const { session, maxTimeMS, readPreference } = getOperationOptions();
      const args = addOperationOptions(Array.from(arguments), optionsIndex, {
        session,
        maxTimeMS,
        readPreference: readMethods.has(methodName) ? readPreference : null
      });
      return method.apply(collection, args);
    };
  }
  return wrapped;
}

function addOperationOptions(args, optionsIndex, { session, maxTimeMS, readPreference }) {
  if (session == null && maxTimeMS == null && readPreference == null) {
    return args;
  }

  while (args.length < optionsIndex) {
    args.push(undefined);
  }

  const options = args[optionsIndex];

  if (options != null && typeof options !== 'object') {
    if (session != null) {
      throw new Error('Cannot run dry run on script where options arg is a non-object');
    }
    throw new Error('Cannot apply Studio operation options to script where options arg is a non-object');
  }

  if (session != null && options?.session != null) {
    throw new Error('Cannot run dry run on script that uses sessions');
  }

  args[optionsIndex] = omitNullish({
    ...(options ?? {}),
    maxTimeMS: maxTimeMS ?? options?.maxTimeMS,
    readPreference: readPreference ?? options?.readPreference,
    session: session ?? options?.session
  });
  return args;
}

module.exports = {
  createScriptDb,
  collectionMethodOptionsIndex
};
