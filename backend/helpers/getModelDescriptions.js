'use strict';

const formatRef = schemaType => (schemaType.options?.ref ? ' (ref: ' + schemaType.options.ref + ')' : '');

const formatNestedSchema = schemaType => {
  const nestedPaths = Object.entries(schemaType.schema.paths).map(
    ([path, nestedSchemaType]) => formatSchemaPath(path, nestedSchemaType)
  );
  return `\n  ${nestedPaths.join('\n  ')}`;
};

const formatSchemaTypeInstance = schemaType => {
  if (schemaType.instance === 'Array') {
    const itemType = schemaType.getEmbeddedSchemaType().instance;
    return itemType === 'DocumentArrayElement' ? 'Subdocument[]' : `${itemType}[]`;
  }
  return schemaType.instance;
};

const formatSchemaPath = (path, schemaType) => `- ${path}: ${formatSchemaTypeInstance(schemaType)}` +
  formatRef(schemaType) +
  (schemaType.schema ? formatNestedSchema(schemaType) : '');

const listModelPaths = Model => [
  ...Object.entries(Model.schema.paths).map(
    ([path, schemaType]) => formatSchemaPath(path, schemaType)
  ),
  ...Object.entries(Model.schema.virtuals).filter(([path, virtual]) => virtual.options?.ref).map(
    ([path, virtual]) => `- ${path}: Virtual (ref: ${virtual.options.ref})`
  )
].join('\n');

const getModelDescriptions = db => Object.values(db.models).filter(Model => !Model.modelName.startsWith('__Studio')).map(Model => `
${Model.modelName} (collection: ${Model.collection.collectionName})
${listModelPaths(Model)}
`.trim()).join('\n\n');

module.exports = getModelDescriptions;
