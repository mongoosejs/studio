'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const { Buffer } = require('buffer');
const validateDocumentWithTimeout = require('../../helpers/validateDocumentWithTimeout');

const SAMPLE_SIZE = 1000;
const MAX_SCHEMA_PATH_DEPTH = 4;

const AnalyzeSchemaParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('AnalyzeSchemaParams');

module.exports = ({ db }) => async function analyzeSchema(params) {
  const { model, roles } = new AnalyzeSchemaParams(params);

  await authorize('Model.analyzeSchema', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const documentCount = await Model.collection.countDocuments();
  const rawDocs = documentCount > SAMPLE_SIZE ?
    await Model.collection.aggregate([{ $sample: { size: SAMPLE_SIZE } }]).toArray() :
    await Model.collection.find({}).toArray();

  const paths = getSchemaPaths(Model.schema);
  const pathTypeCounts = {};
  const pathValueCounts = {};

  for (const path of paths) {
    pathTypeCounts[path.path] = {};
    pathValueCounts[path.path] = 0;
  }

  const validationResults = await Promise.all(rawDocs.map(rawDoc => validateDocumentWithTimeout(Model.hydrate(rawDoc))));
  const validDocumentCount = validationResults.filter(result => result.valid).length;
  const firstValidDocument = validationResults.find(result => result.valid);
  const firstInvalidDocument = validationResults.find(result => !result.valid);

  for (const rawDoc of rawDocs) {
    for (const path of paths) {
      for (const value of getPathValues(rawDoc, path.path, path.arrayParents)) {
        const types = path.arrayPath ? [getType(value)] : getTypes(value);
        pathValueCounts[path.path] += types.length;
        for (const type of types) {
          pathTypeCounts[path.path][type] = (pathTypeCounts[path.path][type] || 0) + 1;
        }
      }
    }
  }

  return {
    analysis: {
      documentCount,
      sampleSize: rawDocs.length,
      sampled: documentCount > SAMPLE_SIZE,
      validDocumentCount,
      invalidDocumentCount: rawDocs.length - validDocumentCount,
      firstValidDocumentId: firstValidDocument?.documentId || null,
      firstInvalidDocumentId: firstInvalidDocument?.documentId || null,
      invalidDocuments: validationResults.filter(result => !result.valid).map(result => ({
        documentId: result.documentId,
        error: result.error,
        errors: result.errors
      })),
      paths: paths.map(path => ({
        path: path.path,
        valueCount: pathValueCounts[path.path],
        ...(path.required ? { required: true } : {}),
        types: Object.keys(pathTypeCounts[path.path]).map(type => ({
          type,
          count: pathTypeCounts[path.path][type]
        })).sort((type1, type2) => type2.count - type1.count)
      }))
    }
  };
};

function getSchemaPaths(schema, prefix, parentArrayParents) {
  prefix = prefix || '';
  parentArrayParents = parentArrayParents || [];

  const paths = [];
  for (const path of Object.keys(schema.paths)) {
    const fullPath = prefix ? `${prefix}.${path}` : path;
    const pathDepth = fullPath.split('.').length;
    if (pathDepth > MAX_SCHEMA_PATH_DEPTH) {
      continue;
    }
    const schemaType = schema.paths[path];
    const arrayParents = parentArrayParents.concat(getSchemaArrayParents(schemaType, fullPath));
    paths.push({
      path: fullPath,
      arrayParents,
      arrayPath: isSchemaArrayPath(schemaType),
      required: schemaType.options?.required === true
    });

    if (schemaType.schema && pathDepth < MAX_SCHEMA_PATH_DEPTH) {
      paths.push(...getSchemaPaths(schemaType.schema, fullPath, arrayParents));
    }
  }
  return paths;
}

function getSchemaArrayParents(schemaType, fullPath) {
  if (isSchemaArrayPath(schemaType)) {
    return [fullPath];
  }
  const parent = schemaType.$parentSchemaDocArray;
  if (parent?.path) {
    return [parent.path];
  }
  return [];
}

function isSchemaArrayPath(schemaType) {
  return schemaType.$isMongooseDocumentArray || schemaType.$isMongooseArray || schemaType.instance === 'Array';
}

function getPathValues(doc, path, arrayParents) {
  return getPathValuesRecursive(doc, path.split('.'), '', new Set(arrayParents));
}

function getPathValuesRecursive(value, parts, currentPath, arrayParents) {
  if (parts.length === 0) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(element => getPathValuesRecursive(element, parts, currentPath, arrayParents));
  }

  if (value == null) {
    return [undefined];
  }

  const nextPart = parts[0];
  const nextPath = currentPath ? `${currentPath}.${nextPart}` : nextPart;
  const nextValue = getPathPartValue(value, nextPart);
  if (nextValue == null && arrayParents.has(nextPath)) {
    return [];
  }

  return getPathValuesRecursive(nextValue, parts.slice(1), nextPath, arrayParents);
}

function getPathPartValue(value, pathPart) {
  if (value instanceof Map) {
    return value.get(pathPart);
  }
  return value[pathPart];
}

function getTypes(value) {
  if (!Array.isArray(value)) {
    return [getType(value)];
  }
  if (value.length === 0) {
    return ['array'];
  }
  const types = new Set();
  for (const element of value) {
    types.add(getType(element));
  }
  return Array.from(types);
}

function getType(value) {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value instanceof Date) {
    return 'date';
  }
  if (Buffer.isBuffer(value)) {
    return 'buffer';
  }
  if (value?._bsontype === 'ObjectId') {
    return 'objectId';
  }
  if (value?._bsontype === 'Decimal128') {
    return 'decimal128';
  }
  return typeof value;
}
