'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');
const z = require('zod/v4');

module.exports = function archetypeToZodSchema(paramsType) {
  if (paramsType?.schema?.json == null) {
    throw new Error('Expected a compiled Archetype params type');
  }

  return objectToZodSchema(paramsType.schema.json());
};

function objectToZodSchema(definition) {
  return z.object(Object.fromEntries(
    Object.entries(definition).map(([path, options]) => [path, pathToZodSchema(options)])
  ));
}

function pathToZodSchema(options) {
  if (options == null || typeof options !== 'object' || Array.isArray(options)) {
    options = { $type: options };
  } else if (!Object.prototype.hasOwnProperty.call(options, '$type')) {
    options = { $type: Object, $schema: options };
  }

  let schema = typeToZodSchema(options.$type, options.$schema);
  if (Array.isArray(options.$enum) && options.$enum.length > 0) {
    schema = z.union(options.$enum.map(value => z.literal(value)));
  }
  if (typeof options.$validate === 'function') {
    schema = schema.refine(value => {
      try {
        options.$validate(value, options);
        return true;
      } catch (_) {
        return false;
      }
    });
  }
  if (!options.$required || options.$default !== undefined) {
    schema = schema.optional();
  }
  if (options.$default !== undefined && typeof options.$default !== 'function') {
    schema = schema.meta({ default: options.$default });
  }
  return schema;
}

function typeToZodSchema(type, nestedSchema) {
  if (Array.isArray(type)) {
    return z.array(typeToZodSchema(type[0]));
  }
  if (type === Archetype.Any) {
    return z.unknown();
  }
  if (type === 'string' || type === String) {
    return z.string();
  }
  if (type === 'number' || type === Number) {
    return z.number();
  }
  if (type === 'boolean' || type === Boolean) {
    return z.boolean();
  }
  if (type === Date || type === mongoose.Types.ObjectId) {
    return z.string();
  }
  if (type === Object) {
    return nestedSchema ? objectToZodSchema(nestedSchema) : z.record(z.string(), z.unknown());
  }
  return z.unknown();
}
