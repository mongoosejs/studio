'use strict';

const listModelPaths = Model => [
  ...Object.entries(Model.schema.paths).map(
    ([path, schemaType]) => `- ${path}: ${schemaType.instance}`
      + (schemaType.options?.ref ? ' (ref: ' + schemaType.options.ref + ')' : '')
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
